import re

# 1. Update API route POST
filepath_post = 'src/app/api/movilfree/products/route.ts'
with open(filepath_post, 'r', encoding='utf-8') as f:
    content_post = f.read()

content_post = content_post.replace(
    "stock: Number(p.stock)",
    "stock: Number(p.stock),\n          imei: p.imei || null"
)
content_post = content_post.replace(
    "stock: Number(data.stock)",
    "stock: Number(data.stock),\n        imei: data.imei || null"
)

with open(filepath_post, 'w', encoding='utf-8') as f:
    f.write(content_post)

# 2. Update API route PUT
filepath_put = 'src/app/api/movilfree/products/[id]/route.ts'
with open(filepath_put, 'r', encoding='utf-8') as f:
    content_put = f.read()

content_put = content_put.replace(
    "stock: Number(data.stock)",
    "stock: Number(data.stock),\n        imei: data.imei || null"
)

with open(filepath_put, 'w', encoding='utf-8') as f:
    f.write(content_put)

print("Updated APIs")
