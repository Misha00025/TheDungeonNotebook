from tests import test_variables
from tests import main_test
from scenarios import *

if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(
                    prog='Test',
                    description='Start testing',
                    epilog='Good testings')
    p.add_argument("-c", "--compact", nargs='?', const=True, default=False)
    p.add_argument("-d", "--debug", nargs='?', const=True, default=False)
    p.add_argument('-S', action='append', help='Добавляет сценарий для исполнения из списка: users, groups, user-group, templates')
    args = p.parse_args()

    if args.S:
        for scenario in args.S:
            match scenario:
                case "users":
                    with_user_scenario()
                case "groups":
                    with_group_scenario()
                case "user-group":
                    with_user_group_scenario()
                case "templates":
                    with_charlist_templates_scenario()
                case "characters":
                    with_characters_scenario()
                case "notes":
                    with_notes_scenario()
                case "group-items":
                    with_group_items_scenario()
                case "character-items":
                    with_character_items_scenario()
                case "attributes":
                    with_skills_attributes()
                case "group_skills":
                    with_group_skills()
                case "character_skills":
                    with_character_skills()

    test_variables.compact = args.compact
    test_variables.debug = args.debug
    main_test.start()