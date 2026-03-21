from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    SPOONACULAR_API_KEY: str = ""
    USDA_API_KEY: str = ""

    class Config:
        env_file = ".env"

settings = Settings()