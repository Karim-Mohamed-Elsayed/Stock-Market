from azure.storage.blob import BlobServiceClient
import os
from dotenv import load_dotenv
load_dotenv()

# Paste the string you just got here
CONN_STR = os.getenv("AZURE_CONNECTION_STRING")
CONTAINER = "bronze"

try:
    service_client = BlobServiceClient.from_connection_string(CONN_STR)
    container_client = service_client.get_container_client(CONTAINER)
    
    # Try to list blobs (even if it's empty)
    print("Connecting to Azure...")
    blobs = container_client.list_blobs()
    print("Connection Successful!")
    print(f"Verified access to container: '{CONTAINER}'")

except Exception as e:
    print("Connection Failed.")
    print(f"Error: {e}")
    print("\nCheck if Member 1 created the container named 'bronze' yet!")