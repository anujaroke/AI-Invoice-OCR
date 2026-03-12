import os
import google.generativeai as genai
from google.api_core import exceptions as g_exceptions
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

model = genai.GenerativeModel('gemini-2.5-flash-lite')
try:
    print("Sending ping...")
    res = model.generate_content("ping")
    print(res.text)
except Exception as e:
    print("Error occurred:")
    print(type(e))
    print(str(e))
