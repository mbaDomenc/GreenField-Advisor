from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from controllers import passwordResetController

router = APIRouter()

class ForgotPasswordRequest(BaseModel):
    "Schema per richiesta forgot password"
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    "Schema per reset password"
    token: str
    newPassword: str

@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """
    Endpoint Fase 1: Richiesta reset password
    
    POST /api/auth/forgot-password
    Body: {"email": "user@example.com"}
    
    Response: {"message": "Se l'email esiste..."}
    """
    return await passwordResetController.request_password_reset(request.email)

@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """
    Endpoint Fase 2: Reset effettivo password
    
    POST /api/auth/reset-password
    Body: {
        "token": "abc123...",
        "newPassword": "NewSecurePass123!"
    }
    
    Response: {"message": "Password reimpostata con successo!"}
    """
    return await passwordResetController.reset_password(
        request.token, 
        request.newPassword
    )

@router.get("/validate-reset-token/{token}")
async def validate_token(token: str):
    """
    Endpoint ausiliario: Valida token prima del reset
    
    GET /api/auth/validate-reset-token/abc123...
    
    Response: {
        "valid": true/false,
        "reason": "...",
        "minutesLeft": 45
    }
    """
    return await passwordResetController.validate_reset_token(token)

@router.delete("/cleanup-tokens")
async def cleanup_tokens():
    """
    Endpoint manutenzione: Pulisce token scaduti
    (Proteggi con autenticazione admin in produzione)
    
    DELETE /api/auth/cleanup-tokens
    """
    return await passwordResetController.cleanup_expired_tokens()
