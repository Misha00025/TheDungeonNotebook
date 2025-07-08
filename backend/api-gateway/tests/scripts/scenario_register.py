
from scripts import outputs


scenarios = {}
includes = []

def register(name: str):
    def wrapper(f):
        wrapper.__name__ = f.__name__
        scenarios[name] = f
        return f
    return wrapper

def include(name: str):
    includes.append(name)

def execute():
    for name in includes:
        if name in scenarios.keys():
            outputs.write_header(f"Scenario '{name}' started")
            scenarios[name]()
        else:
            outputs.write_header(f"!!! Scenario with name '{name}' not found !!!")