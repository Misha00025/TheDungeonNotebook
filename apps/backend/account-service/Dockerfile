FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY account-service.csproj ./
RUN dotnet restore account-service.csproj
COPY . .
RUN dotnet publish account-service.csproj -c Release -o /out --no-restore
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /out .
COPY entrypoint.sh /app/entrypoint.sh
COPY config/accounts.template.json /app/config/accounts.template.json
ENTRYPOINT ["sh", "/app/entrypoint.sh"]
CMD ["dotnet", "account-service.dll"]
