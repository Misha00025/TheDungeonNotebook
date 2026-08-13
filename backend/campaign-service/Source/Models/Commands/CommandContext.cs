namespace Tdn.Models.Commands;

public abstract record CommandScope;
public sealed record CharacterScope(int GroupId, int CharacterId) : CommandScope;
public sealed record CommandContext(int ActorId, CommandScope Scope);
