from pydantic_settings import BaseSettings


class Settings(BaseSettings):

    APP_NAME: str = "GoldSmith AI"

    API_VERSION: str = "1.0.0"

    BLIZZARD_CLIENT_ID: str = ""

    BLIZZARD_CLIENT_SECRET: str = ""

    DATABASE_URL: str = ""

    class Config:
        env_file = ".env"


settings = Settings()