import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# Configurazione SMTP da .env
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# Nome alias per email
EMAIL_SENDER_NAME = "🌱Team di GreenField Advisor"


async def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    from_email: Optional[str] = None
) -> bool:
    """
    Invia email tramite SMTP con alias personalizzato.
    
    Args:
        to_email: Destinatario
        subject: Oggetto email
        html_content: Contenuto HTML
        from_email: Mittente (opzionale)
    
    Returns:
        True se invio riuscito, False altrimenti
    """
    if not SMTP_USER or not SMTP_PASSWORD:
        logger.error("❌ SMTP credentials not configured in .env")
        return False
    
    try:
        # Crea messaggio
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        
        # IMPORTANTE: formataddr per impostare l'alias
        # Formato: "Nome Visualizzato <email@example.com>"
        msg['From'] = formataddr((EMAIL_SENDER_NAME, from_email or SMTP_USER))
        msg['To'] = to_email
        
        # Aggiungi contenuto HTML
        html_part = MIMEText(html_content, 'html', 'utf-8')
        msg.attach(html_part)
        
        # Connessione SMTP
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        
        logger.info(f"✅ Email sent successfully to {to_email}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to send email to {to_email}: {str(e)}")
        return False


def get_password_reset_email_template(reset_link: str, username: str) -> str:
    """
    Template HTML per email di reset password.
    
    Args:
        reset_link: URL per reset password
        username: Nome utente
    
    Returns:
        HTML content dell'email
    """
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
            }}
            .container {{
                background-color: #f9f9f9;
                border-radius: 10px;
                padding: 30px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }}
            .header {{
                text-align: center;
                color: #22c55e;
                margin-bottom: 20px;
            }}
            .logo {{
                font-size: 48px;
                margin-bottom: 10px;
            }}
            .button {{
                display: inline-block;
                padding: 12px 30px;
                background-color: #22c55e;
                color: white !important;
                text-decoration: none;
                border-radius: 5px;
                margin: 20px 0;
                font-weight: bold;
            }}
            .button:hover {{
                background-color: #16a34a;
            }}
            .warning {{
                background-color: #fff3cd;
                border-left: 4px solid #ffc107;
                padding: 10px;
                margin: 15px 0;
            }}
            .footer {{
                margin-top: 30px;
                text-align: center;
                font-size: 12px;
                color: #666;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">🌱</div>
                <h1>GreenField Advisor</h1>
            </div>
            
            <h2>Ciao {username},</h2>
            
            <p>Abbiamo ricevuto una richiesta per reimpostare la password del tuo account.</p>
            
            <p>Clicca sul pulsante qui sotto per creare una nuova password:</p>
            
            <div style="text-align: center;">
                <a href="{reset_link}" class="button">Reimposta Password</a>
            </div>
            
            <div class="warning">
                <strong>⚠️ Importante:</strong>
                <ul>
                    <li>Questo link è valido per <strong>1 ora</strong></li>
                    <li>Può essere utilizzato una sola volta</li>
                    <li>Se non hai richiesto il reset, ignora questa email</li>
                </ul>
            </div>
            
            <p>Se il pulsante non funziona, copia e incolla questo link nel tuo browser:</p>
            <p style="word-break: break-all; color: #666; font-size: 12px;">{reset_link}</p>
            
            <div class="footer">
                <p>Questa è un'email automatica, non rispondere a questo messaggio.</p>
                <p>&copy; 2026 GreenField Advisor. Tutti i diritti riservati.</p>
            </div>
        </div>
    </body>
    </html>
    """
