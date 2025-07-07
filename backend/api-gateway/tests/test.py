import sys
from scripts import outputs, scenario_register
import scenarios
import variables

if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(
                    prog='Test',
                    description='Start testing',
                    epilog='Good testing!')
    p.add_argument("-c", "--compact", nargs='?', const=True, default=False)
    p.add_argument("-d", "--debug", nargs='?', const=True, default=False)
    p.add_argument("--server", type=str, help="Адрес сервера")
    p.add_argument('-S', "--scenario", action='append', help=f'Добавляет сценарий для исполнения. Доступные значения: {", ".join(scenario_register.scenarios.keys())}')
    args = p.parse_args()

    if args.scenario:
        for scenario in args.scenario:
            scenario_register.include(scenario)

    
    if args.server is not None:
        variables.server_url = args.server
    else:
        print("Аргумент '--server' не передан.")
        sys.exit(1)

    outputs.intro()

    scenario_register.execute()

    outputs.end()