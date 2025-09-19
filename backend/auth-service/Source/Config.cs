namespace Tdn.Configuration;


public class Configs
{
    public struct TokenExpire
    {
        public int Days;
        public int Minutes;
    }

    public Configs(TokenExpire? refreshToken = null, TokenExpire? accessToken = null)
    {
        if (refreshToken == null)
            refreshToken = new TokenExpire() { Days = 30, Minutes = 0 };
        RefreshTokenExpire = (TokenExpire)refreshToken;
        if (accessToken == null)
            accessToken = new TokenExpire() { Days = 0, Minutes = 3 };
        AccessTokenExpire = (TokenExpire)accessToken;
    }
    
    public TokenExpire RefreshTokenExpire { get; private set; }
    public TokenExpire AccessTokenExpire { get; private set; }
}