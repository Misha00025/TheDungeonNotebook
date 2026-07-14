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
from scenarios.notes import register_notes_scenario, scenarios as notes_scenarios
from scenarios.local_endpoints import register_local_endpoints_scenario, scenarios as le_scenarios
from scenarios.schemas_lifecycle import register_schemas_scenario, scenarios as sl_scenarios
from scenarios.character_items_access import register_character_items_access_scenario, scenarios as cia_scenarios
from scenarios.character_full_access import register_character_full_access_scenario, scenarios as cfa_scenarios
from scenarios.oidc import register_oidc_scenario, scenarios as oidc_scenarios
from scenarios.auth_flow import register_auth_flow_scenario, scenarios as af_scenarios

if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(
                    prog='Test',
                    description='Start testing',
                    epilog='Good testing!')
    p.add_argument("-c", "--compact", nargs='?', const=True, default=False)
    p.add_argument("-d", "--debug", nargs='?', const=True, default=False)
    p.add_argument("--server", type=str, help="Адрес сервера")
    p.add_argument('-S', "--scenario", action='append', help=f'Добавляет сценарий для исполнения. Доступные значения: GatewayMain, UserProfile, GroupItemsLifecycle, CharacterLifecycle, GroupSkills, CharacterSkillsAssignment, ExportImport, Notes, LocalEndpoints, SchemasLifecycle, CharacterItemsAccess, CharacterFullAccess, OidcEndpoints, AuthFlow')
    args = p.parse_args()

    if args.server is not None:
        variables.server_url = args.server

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
            elif scenario == "Notes":
                register_notes_scenario()
            elif scenario == "LocalEndpoints":
                register_local_endpoints_scenario()
            elif scenario == "SchemasLifecycle":
                register_schemas_scenario()
            elif scenario == "CharacterItemsAccess":
                register_character_items_access_scenario()
            elif scenario == "CharacterFullAccess":
                register_character_full_access_scenario()
            elif scenario == "OidcEndpoints":
                register_oidc_scenario()
            elif scenario == "AuthFlow":
                register_auth_flow_scenario()
    else:
        register_gateway_main()
        register_user_profile_scenario()
        register_group_items_scenario()
        register_character_lifecycle_scenario()
        register_group_skills_scenario()
        register_character_skills_scenario()
        register_export_import_scenario()
        register_notes_scenario()
        register_local_endpoints_scenario()
        register_schemas_scenario()
        register_character_items_access_scenario()
        register_character_full_access_scenario()
        register_oidc_scenario()
        register_auth_flow_scenario()

    all_scenarios = gw_scenarios + up_scenarios + gi_scenarios + cl_scenarios + gs_scenarios + cs_scenarios + ei_scenarios + notes_scenarios + le_scenarios + sl_scenarios + cia_scenarios + cfa_scenarios + oidc_scenarios + af_scenarios
    main_test.start(all_scenarios)
