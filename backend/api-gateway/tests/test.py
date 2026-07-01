import sys
import variables
from tests import test_variables
from tests import main_test
from scenarios.gateway_main import register_gateway_main, scenarios as gw_scenarios

if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(
                    prog='Test',
                    description='Start testing',
                    epilog='Good testing!')
    p.add_argument("-c", "--compact", nargs='?', const=True, default=False)
    p.add_argument("-d", "--debug", nargs='?', const=True, default=False)
    p.add_argument("--server", type=str, help="Адрес сервера")
    p.add_argument('-S', "--scenario", action='append', help=f'Добавляет сценарий для исполнения. Доступные значения: GatewayMain')
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

    main_test.start(gw_scenarios)
