# Test script for transaction API endpoints

# Set the base URL for the API
$baseUrl = "http://localhost:3000/app/v1/api"

Write-Host "Testing Transaction API Endpoints" -ForegroundColor Cyan

# Test 1: Get transactions
Write-Host "`n1. Testing GET transactions API" -ForegroundColor Green
$getTransactionsBody = @{
    user_id = "1"
    transaction_type = "transaction"
    limit = "10"
    offset = "0"
} | ConvertTo-Json

try {
    $getResponse = Invoke-RestMethod -Uri "$baseUrl/transactions" -Method Post -Body $getTransactionsBody -ContentType "application/json"
    Write-Host "Response:" -ForegroundColor Yellow
    $getResponse | ConvertTo-Json -Depth 4
} catch {
    Write-Host "Error occurred:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    if ($_.Exception.Response) {
        $responseStream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($responseStream)
        $responseBody = $reader.ReadToEnd()
        Write-Host $responseBody
    }
}

# Test 2: Add a transaction
Write-Host "`n2. Testing ADD transaction API" -ForegroundColor Green
$addTransactionBody = @{
    user_id = "1"
    order_id = "123"
    type = "credit"
    txn_id = "test-txn-$(Get-Random)"
    amount = "100"
    status = "success"
    message = "Test transaction"
} | ConvertTo-Json

try {
    $addResponse = Invoke-RestMethod -Uri "$baseUrl/add_transaction" -Method Post -Body $addTransactionBody -ContentType "application/json"
    Write-Host "Response:" -ForegroundColor Yellow
    $addResponse | ConvertTo-Json -Depth 4
} catch {
    Write-Host "Error occurred:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    if ($_.Exception.Response) {
        $responseStream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($responseStream)
        $responseBody = $reader.ReadToEnd()
        Write-Host $responseBody
    }
}

# Test 3: Get transactions with search
Write-Host "`n3. Testing GET transactions with search API" -ForegroundColor Green
$searchTransactionsBody = @{
    user_id = "1"
    search = "test"
    limit = "10"
    offset = "0"
} | ConvertTo-Json

try {
    $searchResponse = Invoke-RestMethod -Uri "$baseUrl/transactions" -Method Post -Body $searchTransactionsBody -ContentType "application/json"
    Write-Host "Response:" -ForegroundColor Yellow
    $searchResponse | ConvertTo-Json -Depth 4
} catch {
    Write-Host "Error occurred:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    if ($_.Exception.Response) {
        $responseStream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($responseStream)
        $responseBody = $reader.ReadToEnd()
        Write-Host $responseBody
    }
}

Write-Host "`nTransaction API Tests Completed" -ForegroundColor Cyan 