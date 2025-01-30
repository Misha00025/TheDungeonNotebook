from .scenarios import *


def start():
    # with_user_scenario()
    # with_group_scenario()
    # with_character_scenario()
    with_notes_edit_scenario()

    for scenario in scenarios:
        scenario.start()
        print()

