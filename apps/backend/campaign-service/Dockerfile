FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY campaign-service/CampaignService.csproj campaign-service/
RUN dotnet restore campaign-service/CampaignService.csproj
COPY campaign-service/ campaign-service/
RUN dotnet publish campaign-service/CampaignService.csproj -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "CampaignService.dll"]
