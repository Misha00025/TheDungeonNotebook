namespace Tdn.Models;


internal interface IValueStrategy
{
	void SetValue(object value);
	dynamic GetValue();
}

internal class IntValueStrategy : IValueStrategy
{
	private int _value;

	public void SetValue(object value)
	{
		if (value is int)
			_value = (int)value;
		else
			throw new ArgumentException("Значение должно быть целого типа.");
	}

	public dynamic GetValue() => _value;
}

internal class FloatValueStrategy : IValueStrategy
{
	private float _value;

	public void SetValue(object value)
	{
		if (value is float)
			_value = (float)value;
		else
			throw new ArgumentException("Значение должно быть вещественного типа.");
	}

	public dynamic GetValue() => _value;
}

internal class FlexibleField
{
	private IValueStrategy? _strategy;

	public void SetIntValue(int value)
	{
		_strategy = new IntValueStrategy();
		_strategy.SetValue(value);
	}

	public void SetFloatValue(float value)
	{
		_strategy = new FloatValueStrategy();
		_strategy.SetValue(value);
	}

	public dynamic GetValue()
	{
		var result = _strategy == null ? 0 : _strategy.GetValue();
		if (!(result is int || result is float))
			throw new Exception($"Value type is not int or float");
		return result;
	}
}
