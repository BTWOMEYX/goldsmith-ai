from fastapi import FastAPI

app = FastAPI(
    title="GoldSmith AI API",
    version="0.1.0",
)

@app.get("/")
def root():
    return {
        "message": "Welcome to GoldSmith AI 🚀"
    }

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "GoldSmith AI"
    }
    
@app.get("/api/dashboard")
def dashboard():
    return {
        "profitToday": 245300,
        "bestProfession": "Alchemy",
        "trackedRealms": 1,
        "realm": "Frostmourne",
        "topCrafts": [
            {
                "name": "Flask of Tempering",
                "profit": 4521
            },
            {
                "name": "Potion of Shocking Disclosure",
                "profit": 3814
            },
            {
                "name": "Tempered Alloy",
                "profit": 2991
            }
        ]
    }    