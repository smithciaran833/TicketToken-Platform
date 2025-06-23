#!/bin/bash

echo "📊 TICKETTOKEN KUBERNETES STATUS"
echo "==============================="

echo ""
echo "🏗️ Deployments:"
kubectl get deployments -n tickettoken -o wide

echo ""
echo "📊 Horizontal Pod Autoscalers:"
kubectl get hpa -n tickettoken

echo ""
echo "🌐 Services:"
kubectl get services -n tickettoken

echo ""
echo "🔀 Ingress:"
kubectl get ingress -n tickettoken

echo ""
echo "💾 Pods:"
kubectl get pods -n tickettoken -o wide

echo ""
echo "⚙️ ConfigMaps:"
kubectl get configmaps -n tickettoken

echo ""
echo "🔐 Secrets:"
kubectl get secrets -n tickettoken

echo ""
echo "📈 Resource Usage:"
kubectl top pods -n tickettoken 2>/dev/null || echo "Metrics server not available"

echo ""
echo "🔍 Recent Events:"
kubectl get events -n tickettoken --sort-by='.lastTimestamp' | tail -10
