from pydantic import BaseModel, Field

class ProfessionBase(BaseModel):
    name: str = Field(..., example="Python разработчик", min_length=2, max_length=200)

class ProfessionCreate(ProfessionBase):
    pass

class ProfessionResponse(ProfessionBase):
    id: int

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": 1,
                "name": "Python разработчик"
            }
        }
    }