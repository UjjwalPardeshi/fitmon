extends Control
@onready var rep_count: Label = $TextPanel/HBoxContainer/repcount
@onready var monster: Label = $TextPanel/HBoxContainer/monster
@onready var damagemsg: Label = $damagemsg
@onready var exercise: Label = $TextPanel/HBoxContainer/exercise

@export var enemy:Resource = null
var current_player_health = 1
var current_enemy_health = 1
var current_rep_count = 0
var enemy_alive = true
var curls_count = 0
var squats_count = 0
func get_exercise_count():
	var console = JavaScriptBridge.get_interface("console")
	var document = JavaScriptBridge.get_interface("document")
	var curls = document.getElementById("curls")
	var squats = document.getElementById("squats")
	var latraises = document.getElementById("latraises")
	var lunges = document.getElementById("lunges")
	var exnam = document.getElementById("exercise-name")
	var curls_text = curls.innerHTML.strip_edges()
	var squats_text = squats.innerHTML.strip_edges()
	var latraises_text = latraises.innerHTML.strip_edges()
	var lunges_text = lunges.innerHTML.strip_edges()
	var exnam_text = String(exnam.innerHTML.strip_edges())
	if curls_text.is_valid_int() and squats_text.is_valid_int() and latraises_text.is_valid_int() and lunges_text.is_valid_int():
		current_rep_count = int(curls_text) + int(squats_text) + int(latraises_text) + int(lunges_text)
		display_text(rep_count,"REP COUNT: %d" % current_rep_count)
	display_text(exercise,exnam_text)
# Called when the node enters the scene tree for the first time.
func _ready() -> void:
	get_exercise_count()
	display_text(rep_count,"REP COUNT: %d" % current_rep_count)
	display_text(monster,"%s appears!" % enemy.name)
	set_health($PlayerPanel/PlayerData/ProgressBar,State.current_health, State.max_health)
	set_health($Enemy_Container/ProgressBar,enemy.health,enemy.health)
	$Enemy_Container/Enemy.texture = enemy.texture
	current_player_health = State.current_health
	current_enemy_health = enemy.health

# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta: float) -> void:
	get_exercise_count()
	if current_enemy_health == 0 and enemy_alive:
		enemy_alive = false
		$AnimationPlayer.play("enemy_death")
		display_text(damagemsg,"%s defeated" % enemy.name)
		display_text(monster,"You Win!")
		$EnemyTimer.stop()
		$PlayerTimer.stop()
		
	if current_player_health == 0:
		display_text(damagemsg, "GAME OVER")
		display_text(monster,"You Lose!")
		$EnemyTimer.stop()
		$PlayerTimer.stop()
			
func set_health(progress_bar, health, max_health):
	progress_bar.value = health
	progress_bar.max_value = max_health
	progress_bar.get_node("Label").text = "HP:%d/%d" % [health,max_health]

func display_text(object,text):
	object.text = text
	
func enemy_turn():
	display_text(damagemsg,"%s attacked you!" % enemy.name)
	current_player_health = max(0,current_player_health - enemy.damage)
	$AnimationPlayer.play("screen_shake")
	set_health($PlayerPanel/PlayerData/ProgressBar,current_player_health, State.max_health)
	

func player_turn():
	display_text(damagemsg,"You did %s damage" % current_rep_count)
	current_enemy_health = max(0,current_enemy_health - current_rep_count)
	$AnimationPlayer.play("enemy_damaged")
	set_health($Enemy_Container/ProgressBar,current_enemy_health,enemy.health)



func _on_player_timer_timeout() -> void:
	player_turn()


func _on_enemy_timer_timeout() -> void:
	enemy_turn()
