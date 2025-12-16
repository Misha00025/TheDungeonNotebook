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
    p.add_argument('-S', action='append', help=f'Добавляет сценарий для исполнения из списка: {", ".join(scenarios_command.keys())}')
    args = p.parse_args()

    if args.S:
        print(f"scenarios: {args.S}")
        for scenario in args.S:
            if scenario in scenarios_command.keys():
                scenarios_command[scenario]()

    test_variables.compact = args.compact
    test_variables.debug = args.debug
    main_test.start()