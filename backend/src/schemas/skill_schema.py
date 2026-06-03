from pydantic import BaseModel, Field
from typing import List

class SkillBase(BaseModel):
    name: str = Field(..., example="FastAPI", min_length=1, max_length=100)

class SkillCreate(SkillBase):
    pass

class SkillResponse(SkillBase):
    id: int

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": 1,
                "name": "FastAPI"
            }
        }
    }

class SkillsBatchCreate(BaseModel):
    skills: List[str] = Field(..., example=["Python", "FastAPI", "PostgreSQL"])

    model_config = {
        "json_schema_extra": {
            "example": {
                "skills": ["Python", "FastAPI", "PostgreSQL"]
            }
        }
    }