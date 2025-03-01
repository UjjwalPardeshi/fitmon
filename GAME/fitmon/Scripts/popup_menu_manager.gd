extends MarginContainer

@export var nine_patch_rect: NinePatchRect


func toggle_visibility(object):
	if object.visible:
		object.visible = false
	else:
		object.visible = true


func _on_toggle_menu_button_pressed() -> void:
	toggle_visibility(nine_patch_rect)
