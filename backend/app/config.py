from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List


class Settings(BaseSettings):
    cassandra_hosts: str = Field(default="cassandra")
    cassandra_port: int = Field(default=9042)
    cassandra_keyspace: str = Field(default="zoomarket")
    cassandra_user: str = Field(default="cassandra")
    cassandra_password: str = Field(default="cassandra")
    cassandra_replication_factor: int = Field(default=1)

    redis_host: str = Field(default="redis")
    redis_port: int = Field(default=6379)

    jwt_secret: str = Field(default="change-me")
    jwt_algorithm: str = Field(default="HS256")
    jwt_expires_minutes: int = Field(default=10080)

    seed_on_start: bool = Field(default=True)
    backend_cors_origins: str = Field(default="http://localhost:5173")

    payment_provider: str = Field(default="mock")
    payment_autoapprove: bool = Field(default=True)

    s3_endpoint: str = Field(default="http://minio:9000")
    s3_public_url: str = Field(default="http://localhost:9000")
    s3_bucket: str = Field(default="zoomarket-media")
    s3_access_key: str = Field(default="minioadmin")
    s3_secret_key: str = Field(default="minioadmin")

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.backend_cors_origins.split(",") if o.strip()]

    @property
    def cassandra_hosts_list(self) -> List[str]:
        return [h.strip() for h in self.cassandra_hosts.split(",") if h.strip()]


settings = Settings()
