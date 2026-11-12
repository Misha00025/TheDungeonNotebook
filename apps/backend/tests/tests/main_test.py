import sys


def start(scenarios: list):
	ok = True
	for scenario in scenarios:
		scenario.start()
		if not scenario.ok:
			ok = False
			print()
		else:
			print(scenario.ok)
		
	sys.exit(int(not ok))
