import sys
from .scenarios import *


def start():
	with_user_scenario()
	with_group_scenario()
	with_character_scenario()
	with_notes_edit_scenario()
	# with_notes_edit_scenario(gh, 0)
	with_items_edit_scenario()
	ok = True
	for scenario in scenarios:
		scenario.start()
		if not scenario.ok:
			ok = False
			print()
		else:
			print(scenario.ok)
		
	sys.exit(int(not ok))

