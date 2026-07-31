namespace Tdn.Models.Access;

public enum SubjectType { User, Group, Admin }

public record Subject(SubjectType Type, int Id);
