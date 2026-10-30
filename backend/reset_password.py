from database import collections
from auth import hash_password

email = input("Enter your registered email: ").strip().lower()
new_password = input("Enter new password: ")

c = collections()

result = c["users"].update_one(
    {"email": email},
    {"$set": {"password_hash": hash_password(new_password)}}
)

print("PASSWORD RESET:", result.modified_count == 1)