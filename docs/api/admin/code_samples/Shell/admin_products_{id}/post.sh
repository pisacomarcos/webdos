curl -X POST 'https://medusa-url.com/admin/products/{id}' \
-H 'Authorization: Bearer {api_token}' \
-H 'Content-Type: application/json' \
--data-raw '{
    "title": "Size"
}'
