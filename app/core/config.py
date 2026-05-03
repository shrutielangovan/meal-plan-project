from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str

    # External APIs
    SPOONACULAR_API_KEY: str = ""
    USDA_API_KEY:        str = ""
    gemini_api_key:      str = ""

    # Google OAuth
    GOOGLE_CLIENT_ID:     str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # Support email — Gmail SMTP
    SUPPORT_EMAIL:      str = ""
    GMAIL_APP_PASSWORD: str = ""

    class Config:
        env_file = ".env"


settings = Settings()