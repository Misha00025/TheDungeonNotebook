import sys
import variables
from tests import test_variables
from tests import main_test
from scenarios.gateway_main import register_gateway_main, scenarios as gw_scenarios
from scenarios.user_profile import register_user_profile_scenario, scenarios as up_scenarios
from scenarios.group_items import register_group_items_scenario, scenarios as gi_scenarios
from scenarios.character_lifecycle import register_character_lifecycle_scenario, scenarios as cl_scenarios
from scenarios.group_skills import register_group_skills_scenario, scenarios as gs_scenarios
from scenarios.character_skills import register_character_skills_scenario, scenarios as cs_scenarios
from scenarios.export_import import register_export_import_scenario, scenarios as ei_scenarios

if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(
                    prog='Test',
                    description='Start testing',
                    epilog='Good testing!')
    p.add_argument("-c", "--compact", nargs='?', const=True, default=False)
    p.add_argument("-d", "--debug", nargs='?', const=True, default=False)
    p.add_argument("--server", type=str, help="Адрес сервера")
    p.add_argument('-S', "--scenario", action='append', help=f'Добавляет сценарий для исполнения. Доступные значения: GatewayMain, UserProfile, GroupItemsLifecycle, CharacterLifecycle, GroupSkills, CharacterSkillsAssignment, ExportImport')
    args = p.parse_args()

    if args.server is not None:
        variables.server_url = args.server
    else:
        print("Аргумент '--server' не передан.")
        sys.exit(1)

    test_variables.compact = args.compact
    test_variables.debug = args.debug

    print("#  Tests started  #")

    if args.scenario:
        for scenario in args.scenario:
            if scenario == "GatewayMain":
                register_gateway_main()
            elif scenario == "UserProfile":
                register_user_profile_scenario()
            elif scenario == "GroupItemsLifecycle":
                register_group_items_scenario()
            elif scenario == "CharacterLifecycle":
                register_character_lifecycle_scenario()
            elif scenario == "GroupSkills":
                register_group_skills_scenario()
            elif scenario == "CharacterSkillsAssignment":
                register_character_skills_scenario()
            elif scenario == "ExportImport":
                register_export_import_scenario()

    all_scenarios = gw_scenarios + up_scenarios + gi_scenarios + cl_scenarios + gs_scenarios + cs_scenarios + ei_scenarios
    main_test.start(all_scenarios)
