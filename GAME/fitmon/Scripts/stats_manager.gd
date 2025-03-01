extends VBoxContainer
@onready var fit_bux_label: Label = $FitBuxLabel
@onready var score_label: Label = $ScoreLabel

var coins := str(84)
var score := str(1500)

# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta: float) -> void:
	pass
	#coins = str(global.coins)
	#score = str(global.score) replace this later 
	update_text()
	
func update_text():
	fit_bux_label.text = ("FITBUX: "+ coins)
	score_label.text = ("SCORE: "+score)
