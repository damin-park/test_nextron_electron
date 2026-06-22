from fastapi import FastAPI


app = FastAPI(title="Nextron Backend")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
