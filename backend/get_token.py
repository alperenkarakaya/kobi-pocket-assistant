print("1. Kütüphaneler yükleniyor...")
import os
from google_auth_oauthlib.flow import InstalledAppFlow
from dotenv import load_dotenv

print("2. .env dosyası okunuyor...")
load_dotenv()

SCOPES = ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.readonly']

def get_refresh_token():
    print("3. Kimlik bilgileri kontrol ediliyor...")
    client_id = os.getenv("GMAIL_CLIENT_ID")
    client_secret = os.getenv("GMAIL_CLIENT_SECRET")
    
    if not client_id or not client_secret:
        print("HATA: .env dosyasında GMAIL_CLIENT_ID veya GMAIL_CLIENT_SECRET eksik!")
        return

    client_config = {
        "installed": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }

    print("4. Tarayıcı tetikleniyor. Lütfen Google hesabınızla onay verin...")
    flow = InstalledAppFlow.from_client_config(client_config, SCOPES)
    creds = flow.run_local_server(port=0)
    
    print("\n" + "="*50)
    print("İŞTE REFRESH TOKEN'INIZ (Bunu .env dosyasına yapıştırın):")
    print(creds.refresh_token)
    print("="*50 + "\n")

if __name__ == "__main__":
    get_refresh_token()