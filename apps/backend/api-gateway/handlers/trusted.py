import os


def load_secret(name):
    value = os.environ.get(name)
    file_name = os.environ.get(name + "_FILE")
    if value is not None and file_name is not None:
        raise ValueError("conflicting secret configuration")
    if file_name is not None:
        with open(file_name, "rb") as source:
            value = source.read().strip().decode("utf-8")
    if value is None or len(value.encode("utf-8")) < 32:
        raise ValueError("secret must contain at least 32 bytes")
    return value


INTERNAL_SERVICE_KEY = load_secret("INTERNAL_SERVICE_KEY")


def trusted_headers(ctx, include_subject=True):
    headers = {"X-Internal-Service-Key": INTERNAL_SERVICE_KEY}
    subject = ctx.state.get("x_subject") if include_subject else None
    if subject:
        headers["X-Subject"] = subject
    return headers
