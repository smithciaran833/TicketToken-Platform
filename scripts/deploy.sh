#!/bin/bash

echo "🚀 DEPLOYING TICKETTOKEN TO KUBERNETES"
echo "===================================="

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl not found. Please install kubectl first."
    exit 1
fi

# Check if cluster is accessible
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Cannot connect to Kubernetes cluster. Please check your config."
    exit 1
fi

echo "📋 Creating namespace..."
kubectl apply -f kubernetes/namespace.yaml

echo "⚙️ Creating ConfigMaps..."
kubectl apply -f kubernetes/configmaps/

echo "🔐 Creating Secrets (make sure to update with real values)..."
echo "⚠️  WARNING: Update kubernetes/secrets/app-secrets-template.yaml with real values first!"
read -p "Have you updated the secrets with real values? (y/n): " confirm
if [[ $confirm == [yY] || $confirm == [yY][eE][sS] ]]; then
    kubectl apply -f kubernetes/secrets/
else
    echo "⏸️  Skipping secrets deployment. Update them manually later."
fi

echo "🏗️ Deploying applications..."
kubectl apply -f kubernetes/deployments/

echo "🌐 Creating services..."
kubectl apply -f kubernetes/services/

echo "🔀 Creating ingress..."
kubectl apply -f kubernetes/ingress/

echo "📊 Setting up monitoring..."
kubectl apply -f kubernetes/monitoring/

echo "✅ Deployment complete!"
echo ""
echo "📊 Check deployment status:"
echo "   kubectl get pods -n tickettoken"
echo "   kubectl get services -n tickettoken"
echo "   kubectl get ingress -n tickettoken"
echo ""
echo "📈 Monitor scaling:"
echo "   kubectl get hpa -n tickettoken"
echo ""
echo "🔍 View logs:"
echo "   kubectl logs -f deployment/tickettoken-api -n tickettoken"
echo "   kubectl logs -f deployment/tickettoken-cache -n tickettoken"
echo ""
