from google import genai

# PUT YOUR KEY HERE (NO JAPANESE CHARACTERS)
# 例: client = genai.Client(api_key="AIza...")
client = genai.Client(api_key="AIzaSyDL0KZeu7Wl1AQf10ZbR0ilMsafDE8lXWs")

print("--- START ---")
for model in client.models.list():
    print(model.name)
print("--- END ---")