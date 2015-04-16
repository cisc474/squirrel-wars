var app = angular.module('squirrels', []);

//the main squirrel class, from type to type I adjust the 'action' that happens every 32 - 2*level ticks

var Squirrel = function(start){
  this.type = start.type;
  this.$scope = start.$scope;
  this.level = 1;
  this.counter = 30;
  this.timer = 1;
  this.active = false;
  this.hurt = false;
  this.dead = false;
  this.gameovermessage = "Game over.";
  var that = this;
  //every game object needs an update function which gets run every tick
  this.update = function(){
    that.timer = (that.timer + 1) % that.counter;
    if (that.timer > 3){
      that.active = false;
      that.hurt = false;
    } else if (that.timer === 0){
      that.action();
      that.active = true;
    }
  };
  //I want my squirrels to level up, I capped them at level 10
  this.levelUp = function(){
    if (that.level < 10){
      that.level += 1;
      that.counter = 32 - 2*that.level;
    }
  };
  //when they get attacked they level down and possibly die
  this.levelDown = function(){
    if (that.level > 1){
      that.$scope.message = "You have been attacked, "+
        "squirrel level down.";
      that.level -= 1;
      that.counter = 32 - 2*that.level;
      that.hurt = true;
    } else {
      that.$scope.deadSquirrel(that);
      that.dead = true;
    }
  };
  //soldiers attack, trainers train, breeders breed
  this.action = function(){
    if (that.type == "soldier"){
      that.$scope.attack(that);
    } else if (that.type == "trainer"){
      that.$scope.train();
    } else if (that.type == "breeder"){
      that.$scope.breed();
    }
  };
};

//monsters attack every 40-level ticks
var Monster = function(level, $scope){
  this.$scope = $scope;
  this.health = level*10;
  this.timer = 1;
  this.level = level;
  this.attackTime = Math.max(40 - level, 1);
  var that = this;
  this.update = function(){
    that.timer = (that.timer + 1) % that.attackTime;
    if (that.timer === 0){
      that.$scope.monsterAttack(that);
    }
  };
};

var remove_from = function(arr, obj){
  var index = arr.indexOf(obj);
  if (index > -1){
    arr.splice(index, 1);
  }
};

//my pub/sub/hub join into the ticker or remove yourself, get update called whenever this updates
var Updater = function(){
  this.hooks = [];
  var that = this;
  this.join = function(obj){
    that.hooks.push(obj);
  };
  this.remove = function(obj){
    remove_from(that.hooks, obj);
  };
  this.update = function(){
    for (var i = 0; i < that.hooks.length; i++) {
      that.hooks[i].update();
    }
  };
};



app.controller("Ctrl", ["$scope", function($scope){
  $scope.new_ready = true;
  $scope.breeders = [];
  $scope.trainers = [];
  $scope.army = [];
  $scope.nuts = 5;
  $scope.monster_level = 1;
  $scope.timer = 0;
  $scope.level = 1;
  $scope.rate = 1000;
  $scope.updater = new Updater();
  $scope.message = "Game on. You are level 1.";
  $scope.gameover = false;
  $scope.monster = new Monster($scope.monster_level, $scope);
  $scope.updater.join($scope.monster);
  
  //the game brains updater
  $scope.update = function(){
    if ($scope.timer > 0){
      $scope.timer = $scope.timer - 1;
      $scope.$apply();
    } else {
      $scope.new_ready = true;
      $scope.$apply();
    }
  };
  
  $scope.updater.join($scope);
  
  //also players can level up
  $scope.levelUp = function(){
      $scope.monster_level += 1;
      $scope.updater.remove($scope.monster);
      $scope.monster = new Monster($scope.monster_level, $scope);
      $scope.updater.join($scope.monster);
      $scope.nuts += 10*($scope.monster_level - 1);
      if ($scope.nuts > 99999) {
        $scope.gameWon();
      }
      if ($scope.level < 30){
        $scope.level += 1;
      }
      $scope.$apply();
  };
  
  $scope.monsterAttack = function(monster){
    var attacks = $scope.level * monster.level;
    for (var k = 0; k < monster.level; k++){
      var target = random_sql();
      if (!!target){
        target.levelDown();
      } else {
        $scope.nuts -= monster.level;
        $scope.message = "Monster took "+monster.level+" nut(s).";
        if ($scope.nuts < 0){
          $scope.gameLost();
        }
      }
    }
    $scope.$apply();
  };
  
  $scope.deadSquirrel = function(sql){
    $scope.updater.remove(sql);
    $scope.message = "You lost a squirrel.";
    var stype = sql.type;
    var sqls = fetch_sqls(stype);
    remove_from(sqls, sql);
    $scope.$apply();
  };
  
  //this is where I turn on the ticker, it is currently running at x2 speed
  var intID = window.setInterval($scope.updater.update, 500);
  
  $scope.gameLost = function(){
    $scope.gameover = true;
    window.clearInterval(intID);
    $scope.gameovermessage = "You have lost your nuts!  Game over...";
  };

  $scope.gameWon = function(){
    $scope.gameover = true;
    window.clearInterval(intID);
    $scope.gameovermessage = "You have 100000 nuts!  You win.";
  };
  
  $scope.resetTimer = function(time){
    $scope.rate = time;
    window.clearInterval(intID);
    intID = window.setInterval($scope.updater.update, time);
  };

  var make = function(s_type){
    var sql = new Squirrel({$scope: $scope, type: s_type});
    $scope.updater.join(sql);
    var sqls = fetch_sqls(s_type);
    sqls.push(sql);
    $scope.message = "You spawned a new "+s_type;
  };
  
  $scope.make = function(s_type){
    make(s_type);
    $scope.timer = 31 - $scope.level;
    $scope.new_ready = false;
  };

  var random_el = function(arr){
    var i = Math.floor(Math.random()*arr.length);
    if (arr.length > 0){
      return arr[i];
    }
    return false;
  };

  var random_sql_type = function(){
    var types = ["soldier", "breeder", "trainer"];
    return random_el(types);
  };

  var random_sql = function(){
    var sql_arrs = [$scope.army, $scope.breeders, $scope.trainers];
    var rand_arr = random_el(sql_arrs);
    return random_el(rand_arr);
  };
  
  $scope.attack = function(sql){
    $scope.monster.health -= sql.level;
    if ($scope.monster.health <= 0){
      $scope.message = "Your killed the enemy. Level up!";
      $scope.levelUp();
    } else {
      $scope.message = "Your squirrel attacked the enemy for "+
        sql.level+" damage";
    }
    $scope.$apply();
  };
  
  var fetch_sqls = function(stype){
    if (stype == "soldier"){
      return $scope.army;
    } else if (stype == "breeder") {
      return $scope.breeders;
    } else if (stype == "trainer") {
      return $scope.trainers;
    }
  };
  
  $scope.train = function(sql){
    /*var rtype = random_sql_type();
    var sqls = fetch_sqls(rtype);
    for(var j = 0; j < sqls.length; j++){
      sqls[j].levelUp();
    }*/
    var sql = random_sql();
    if (sql){
      sql.levelUp();
      $scope.message = "A " + sql.type + " leveled up";
      $scope.$apply();
    }
  };
  
  $scope.breed = function(sql){
    var rtype = random_sql_type();
    make(rtype);
    $scope.message = "Gave birth to a new " + rtype;
    $scope.$apply();
  };
  
}]);
