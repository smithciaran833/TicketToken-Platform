#!/bin/bash

echo "⚡ TICKETTOKEN SCALING OPERATIONS"
echo "================================"

if [ $# -eq 0 ]; then
    echo "Usage: $0 <component> <replicas>"
    echo "Components: api, cache, worker"
    echo "Example: $0 api 10"
    exit 1
fi

COMPONENT=$1
REPLICAS=$2

case $COMPONENT in
    api)
        kubectl scale deployment tickettoken-api --replicas=$REPLICAS -n tickettoken
        ;;
    cache)
        kubectl scale deployment tickettoken-cache --replicas=$REPLICAS -n tickettoken
        ;;
    worker)
        kubectl scale deployment tickettoken-worker --replicas=$REPLICAS -n tickettoken
        ;;
    *)
        echo "Unknown component: $COMPONENT"
        echo "Available components: api, cache, worker"
        exit 1
        ;;
esac

echo "✅ Scaled $COMPONENT to $REPLICAS replicas"
echo "📊 Current status:"
kubectl get deployments -n tickettoken
