"""Unit conversion for stock quantities."""

_MASS = {
    "kg": 1.0, "kilogram": 1.0, "kilo": 1.0,
    "ton": 1000.0, "tonne": 1000.0, "t": 1000.0,
    "gram": 0.001, "gr": 0.001, "g": 0.001,
    "quintal": 100.0, "kental": 100.0,
}

_VOL = {
    "litre": 1.0, "litr": 1.0, "lt": 1.0, "l": 1.0, "liter": 1.0,
    "m3": 1000.0, "m³": 1000.0,
    "ml": 0.001, "cc": 0.001,
}


def convert_quantity(qty: float, from_unit: str, to_unit: str) -> float:
    fu = from_unit.lower().strip()
    tu = to_unit.lower().strip()
    if fu == tu:
        return qty
    if fu in _MASS and tu in _MASS:
        return round(qty * _MASS[fu] / _MASS[tu], 6)
    if fu in _VOL and tu in _VOL:
        return round(qty * _VOL[fu] / _VOL[tu], 6)
    return qty
