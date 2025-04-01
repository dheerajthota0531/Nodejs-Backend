# PowerShell test script for get_settings API

$body = @{
    type = "all"
    user_id = 1
} | ConvertTo-Json

Write-Host "Testing get_settings API..."
Write-Host "Sending request to: http://localhost:3000/app/v1/api/get_settings"

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/app/v1/api/get_settings" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body

    Write-Host "STATUS: $($response.StatusCode)"
    
    if ($response.StatusCode -eq 200) {
        $jsonResponse = $response.Content | ConvertFrom-Json
        
        Write-Host "`nResponse structure:"
        Write-Host "- error: $($jsonResponse.error)"
        Write-Host "- message: $($jsonResponse.message)"
        
        if ($jsonResponse.data) {
            $dataFields = $jsonResponse.data.PSObject.Properties.Name -join ", "
            Write-Host "- data fields: $dataFields"
            
            # Check for image URLs in the response
            Write-Host "`nChecking image URLs:"
            
            # Check logo URL
            if ($jsonResponse.data.logo -and $jsonResponse.data.logo.Count -gt 0) {
                Write-Host "- Logo URL: $($jsonResponse.data.logo[0].value)"
                Write-Host "- Logo URL uses CDN: $($jsonResponse.data.logo[0].value -like '*uzvisimages.blr1.cdn.digitaloceanspaces.com*')"
            } else {
                Write-Host "- No logo found in response"
            }
            
            # Check popup offer image URL if exists
            if ($jsonResponse.data.popup_offer -and $jsonResponse.data.popup_offer.Count -gt 0) {
                Write-Host "- Popup offer image URL: $($jsonResponse.data.popup_offer[0].image)"
                Write-Host "- Popup offer URL uses CDN: $($jsonResponse.data.popup_offer[0].image -like '*uzvisimages.blr1.cdn.digitaloceanspaces.com*')"
            } else {
                Write-Host "- No popup offer found in response"
            }
            
            if ($jsonResponse.error) {
                Write-Host "ERROR: $($jsonResponse.message)" -ForegroundColor Red
            } else {
                Write-Host "`nSUCCESS!" -ForegroundColor Green
                
                # Check for system_settings
                if ($jsonResponse.data.system_settings -and $jsonResponse.data.system_settings.Count -gt 0) {
                    $settings = $jsonResponse.data.system_settings[0]
                    Write-Host "✓ system_settings found!" -ForegroundColor Green
                    
                    # Check for wallet_balance_amount
                    if ($settings.wallet_balance_amount) {
                        Write-Host "✓ wallet_balance_amount: $($settings.wallet_balance_amount)" -ForegroundColor Green
                        Write-Host "✓ wallet_balance_amount type: $($settings.wallet_balance_amount.GetType().Name)" -ForegroundColor Green
                    } else {
                        Write-Host "✗ wallet_balance_amount not found in system_settings" -ForegroundColor Red
                    }
                    
                    # Check a few other key fields
                    if ($settings.currency) {
                        Write-Host "✓ currency: $($settings.currency)" -ForegroundColor Green
                    }
                    
                    if ($settings.welcome_wallet_balance_on) {
                        Write-Host "✓ welcome_wallet_balance_on: $($settings.welcome_wallet_balance_on)" -ForegroundColor Green
                    }
                } else {
                    Write-Host "✗ system_settings not found in response" -ForegroundColor Red
                }
                
                # Check time_slot_config
                if ($jsonResponse.data.time_slot_config -and $jsonResponse.data.time_slot_config.Count -gt 0) {
                    $tsc = $jsonResponse.data.time_slot_config[0]
                    Write-Host "✓ time_slot_config found!" -ForegroundColor Green
                    Write-Host "  - delivery_starts_from: $($tsc.delivery_starts_from)" -ForegroundColor Green
                    Write-Host "  - delivery_starts_from type: $($tsc.delivery_starts_from.GetType().Name)" -ForegroundColor Green
                    Write-Host "  - starting_date: $($tsc.starting_date)" -ForegroundColor Green
                } else {
                    Write-Host "✗ time_slot_config not found in response" -ForegroundColor Red
                }
            }
        } else {
            Write-Host "No data in response" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "Status code: $statusCode" -ForegroundColor Red
        
        if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
            Write-Host "Response: $($_.ErrorDetails.Message)" -ForegroundColor Red
        }
    }
} 