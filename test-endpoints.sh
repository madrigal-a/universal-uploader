#!/bin/bash
# =============================================================================
# Unified Test Script for Universal Uploader API
# =============================================================================
# Usage:
#   bash test-endpoints.sh [options]
#
# Options:
#   --aws      Test AWS S3
#   --r2       Test Cloudflare R2
#   --azure    Test Azure Blob Storage
#   --gcs      Test Google Cloud Storage
#   --all      Test all configured providers
#   --help     Show this help
#
# Examples:
#   bash test-endpoints.sh --aws
#   bash test-endpoints.sh --aws --gcs
#   bash test-endpoints.sh --all
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

# Configuration
CONFIG_FILE="test-config.json"
RESULTS=()
FAILED=0

# Help function
show_help() {
    echo -e "${BOLD}Universal Uploader - Test Script${NC}"
    echo ""
    echo "Usage: bash test-endpoints.sh [options]"
    echo ""
    echo "Options:"
    echo "  --aws      Test AWS S3"
    echo "  --r2       Test Cloudflare R2"
    echo "  --azure    Test Azure Blob Storage"
    echo "  --gcs      Test Google Cloud Storage"
    echo "  --all      Test all providers"
    echo "  --help     Show this help"
    echo ""
    echo "Examples:"
    echo "  bash test-endpoints.sh --aws"
    echo "  bash test-endpoints.sh --aws --gcs"
    echo "  bash test-endpoints.sh --all"
    exit 0
}

# Check dependencies
check_dependencies() {
    if [ ! -f "$CONFIG_FILE" ]; then
        echo -e "${RED}Error: $CONFIG_FILE not found${NC}"
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        echo -e "${YELLOW}Installing jq...${NC}"
        sudo apt-get update && sudo apt-get install -y jq
    fi

    if ! command -v curl &> /dev/null; then
        echo -e "${RED}Error: curl is not installed${NC}"
        exit 1
    fi
}

# Load global configuration
load_config() {
    API_BASE=$(jq -r '.apiBaseUrl' $CONFIG_FILE)
    TEST_USER=$(jq -r '.testUserId' $CONFIG_FILE)
}

# Generic test function
# Args: $1=provider, $2=color, $3=display_name
test_provider() {
    local provider=$1
    local color=$2
    local display_name=$3
    
    echo ""
    echo -e "${color}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${color}   Testing: ${display_name}${NC}"
    echo -e "${color}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Get credentials based on provider
    local access_key secret_key bucket filename extra_field=""
    
    case $provider in
        aws)
            access_key=$(jq -r '.aws.accessKeyId' $CONFIG_FILE)
            secret_key=$(jq -r '.aws.secretAccessKey' $CONFIG_FILE)
            bucket=$(jq -r '.aws.bucket' $CONFIG_FILE)
            filename=$(jq -r '.aws.testFilename' $CONFIG_FILE)
            
            if [[ "$access_key" == "YOUR_AWS_ACCESS_KEY_HERE" ]] || [[ "$access_key" == "null" ]]; then
                echo -e "${YELLOW}⊘ Skipping AWS: credentials not configured${NC}"
                RESULTS+=("${YELLOW}⊘${NC} AWS S3: Not configured")
                return
            fi
            
            creds="{\"accessKeyId\":\"$access_key\",\"secretAccessKey\":\"$secret_key\"}"
            ;;
        r2)
            local account_id=$(jq -r '.r2.accountId' $CONFIG_FILE)
            access_key=$(jq -r '.r2.accessKeyId' $CONFIG_FILE)
            secret_key=$(jq -r '.r2.secretAccessKey' $CONFIG_FILE)
            bucket=$(jq -r '.r2.bucket' $CONFIG_FILE)
            filename=$(jq -r '.r2.testFilename' $CONFIG_FILE)
            
            if [[ "$account_id" == "YOUR_CLOUDFLARE_ACCOUNT_ID_HERE" ]] || [[ "$account_id" == "null" ]]; then
                echo -e "${YELLOW}⊘ Skipping R2: credentials not configured${NC}"
                RESULTS+=("${YELLOW}⊘${NC} Cloudflare R2: Not configured")
                return
            fi
            
            creds="{\"accountId\":\"$account_id\",\"accessKeyId\":\"$access_key\",\"secretAccessKey\":\"$secret_key\"}"
            ;;
        azure)
            local account_name=$(jq -r '.azure.accountName' $CONFIG_FILE)
            local account_key=$(jq -r '.azure.accountKey' $CONFIG_FILE)
            bucket=$(jq -r '.azure.container' $CONFIG_FILE)
            filename=$(jq -r '.azure.testFilename' $CONFIG_FILE)
            
            if [[ "$account_name" == "YOUR_AZURE_STORAGE_ACCOUNT_NAME" ]] || [[ "$account_name" == "null" ]]; then
                echo -e "${YELLOW}⊘ Skipping Azure: credentials not configured${NC}"
                RESULTS+=("${YELLOW}⊘${NC} Azure Blob: Not configured")
                return
            fi
            
            creds="{\"accountName\":\"$account_name\",\"accountKey\":\"$account_key\"}"
            ;;
        gcs)
            access_key=$(jq -r '.gcs.accessKeyId' $CONFIG_FILE)
            secret_key=$(jq -r '.gcs.secretAccessKey' $CONFIG_FILE)
            bucket=$(jq -r '.gcs.bucket' $CONFIG_FILE)
            filename=$(jq -r '.gcs.testFilename' $CONFIG_FILE)
            
            if [[ "$access_key" == "YOUR_GCS_HMAC_ACCESS_KEY_HERE" ]] || [[ "$access_key" == "null" ]]; then
                echo -e "${YELLOW}⊘ Skipping GCS: credentials not configured${NC}"
                RESULTS+=("${YELLOW}⊘${NC} Google Cloud: Not configured")
                return
            fi
            
            creds="{\"accessKeyId\":\"$access_key\",\"secretAccessKey\":\"$secret_key\"}"
            ;;
    esac
    
    # STEP 1: Save credentials
    echo -e "${YELLOW}[1/3]${NC} Saving credentials..."
    
    local config_response=$(curl -s -X POST "$API_BASE/api/config" \
      -H "Content-Type: application/json" \
      -H "X-User-ID: $TEST_USER" \
      -d "{\"provider\":\"$provider\",\"credentials\":$creds}")
    
    if ! echo "$config_response" | jq -e '.success' > /dev/null 2>&1; then
        echo -e "${RED}✗ Error saving credentials${NC}"
        echo "$config_response" | jq .
        RESULTS+=("${RED}✗${NC} $display_name: Credential error")
        FAILED=$((FAILED + 1))
        return
    fi
    echo -e "${GREEN}✓${NC} Credentials saved"
    
    # STEP 2: Generate URL
    echo -e "${YELLOW}[2/3]${NC} Generating presigned URL..."
    
    local url_response=$(curl -s -X POST "$API_BASE/api/generate-url" \
      -H "Content-Type: application/json" \
      -H "X-User-ID: $TEST_USER" \
      -d "{\"provider\":\"$provider\",\"bucket\":\"$bucket\",\"filename\":\"$filename\"}")
    
    local signed_url=$(echo "$url_response" | jq -r '.url')
    
    if [[ "$signed_url" == "null" ]] || [[ -z "$signed_url" ]]; then
        echo -e "${RED}✗ Error generating URL${NC}"
        echo "$url_response" | jq .
        RESULTS+=("${RED}✗${NC} $display_name: URL generation error")
        FAILED=$((FAILED + 1))
        return
    fi
    echo -e "${GREEN}✓${NC} URL generated"
    
    # STEP 3: Upload file
    echo -e "${YELLOW}[3/3]${NC} Uploading test file..."
    
    local test_content="=== Universal Uploader Test ===
Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
Provider: $display_name
Bucket: $bucket
File: $filename
Status: SUCCESS
==================================="
    
    echo "$test_content" > /tmp/test_upload_$provider.txt
    
    # Execute curl based on provider
    # Azure requires additional header: x-ms-blob-type: BlockBlob
    local http_status
    if [[ "$provider" == "azure" ]]; then
        http_status=$(curl -s -o /tmp/upload_response_$provider.txt -w "%{http_code}" \
          -X PUT "$signed_url" \
          -H "Content-Type: text/plain" \
          -H "x-ms-blob-type: BlockBlob" \
          --data-binary @/tmp/test_upload_$provider.txt)
    else
        http_status=$(curl -s -o /tmp/upload_response_$provider.txt -w "%{http_code}" \
          -X PUT "$signed_url" \
          -H "Content-Type: text/plain" \
          --data-binary @/tmp/test_upload_$provider.txt)
    fi
    
    if [[ "$http_status" == "200" ]] || [[ "$http_status" == "201" ]] || [[ "$http_status" == "204" ]]; then
        echo -e "${GREEN}✓ File uploaded successfully (HTTP $http_status)${NC}"
        RESULTS+=("${GREEN}✓${NC} $display_name: OK")
    else
        echo -e "${RED}✗ Error uploading file (HTTP $http_status)${NC}"
        cat /tmp/upload_response_$provider.txt
        RESULTS+=("${RED}✗${NC} $display_name: HTTP $http_status")
        FAILED=$((FAILED + 1))
    fi
    
    rm -f /tmp/test_upload_$provider.txt /tmp/upload_response_$provider.txt
}

# Main
main() {
    local test_aws=false
    local test_r2=false
    local test_azure=false
    local test_gcs=false
    
    # Parse arguments
    if [[ $# -eq 0 ]]; then
        show_help
    fi
    
    for arg in "$@"; do
        case $arg in
            --aws) test_aws=true ;;
            --r2) test_r2=true ;;
            --azure) test_azure=true ;;
            --gcs) test_gcs=true ;;
            --all)
                test_aws=true
                test_r2=true
                test_azure=true
                test_gcs=true
                ;;
            --help|-h) show_help ;;
            *)
                echo -e "${RED}Unknown option: $arg${NC}"
                show_help
                ;;
        esac
    done
    
    echo -e "${BOLD}${CYAN}"
    echo "╔══════════════════════════════════════════╗"
    echo "║     Universal Uploader - Test Suite      ║"
    echo "╚══════════════════════════════════════════╝"
    echo -e "${NC}"
    
    check_dependencies
    load_config
    
    echo -e "API: ${BLUE}$API_BASE${NC}"
    echo -e "User: ${BLUE}$TEST_USER${NC}"
    
    # Run selected tests
    [[ "$test_aws" == true ]] && test_provider "aws" "$BLUE" "AWS S3"
    [[ "$test_r2" == true ]] && test_provider "r2" "$CYAN" "Cloudflare R2"
    [[ "$test_azure" == true ]] && test_provider "azure" "$BLUE" "Azure Blob Storage"
    [[ "$test_gcs" == true ]] && test_provider "gcs" "$MAGENTA" "Google Cloud Storage"
    
    # Summary
    echo ""
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}                SUMMARY                 ${NC}"
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    for result in "${RESULTS[@]}"; do
        echo -e "  $result"
    done
    
    echo ""
    if [[ $FAILED -eq 0 ]]; then
        echo -e "${GREEN}${BOLD}All tests passed ✓${NC}"
        exit 0
    else
        echo -e "${RED}${BOLD}$FAILED test(s) failed${NC}"
        exit 1
    fi
}

main "$@"
