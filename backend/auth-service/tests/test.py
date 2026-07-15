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
    p.add_argument('-S', action='append', help='Добавляет сценарий для исполнения из списка: auth, port-protection')
    args = p.parse_args()

    if args.S:
        for scenario in args.S:
            match scenario:
                case "auth":
                    with_auth_service_scenario()
                case "port-protection":
                    with_internal_endpoint_protection_scenario()
    else:
        with_auth_service_scenario()
        with_internal_endpoint_protection_scenario()

    test_variables.compact = args.compact
    test_variables.debug = args.debug
    main_test.start()
