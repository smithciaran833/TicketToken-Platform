import axios from 'axios';
import { createHash } from 'crypto';

interface KYCRequest {
  userId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  documentType: 'passport' | 'drivers_license' | 'national_id';
  documentNumber: string;
  documentImage: string; // base64
  selfieImage: string; // base64
}

interface KYCResult {
  status: 'pending' | 'approved' | 'rejected' | 'requires_review';
  confidence: number;
  checks: {
    documentValid: boolean;
    faceMatch: boolean;
    addressVerified: boolean;
    sanctionsCheck: boolean;
    pepCheck: boolean; // Politically Exposed Person
  };
  riskScore: number;
  reviewNotes?: string;
  verificationId: string;
}

export class KYCVerificationService {
  private verifications: Map<string, KYCResult> = new Map();

  constructor() {
    console.log('🆔 KYC Verification Service initialized');
  }

  async submitKYC(request: KYCRequest): Promise<string> {
    console.log(`🆔 Processing KYC for user: ${request.userId}`);
    
    const verificationId = `kyc_${createHash('sha256').update(request.userId + Date.now()).digest('hex').substring(0, 16)}`;
    
    // Simulate document verification
    const documentValid = await this.verifyDocument(request.documentType, request.documentNumber, request.documentImage);
    
    // Simulate face matching
    const faceMatch = await this.compareFaces(request.documentImage, request.selfieImage);
    
    // Simulate address verification
    const addressVerified = await this.verifyAddress(request.address);
    
    // Check sanctions lists
    const sanctionsCheck = await this.checkSanctions(request.firstName, request.lastName, request.dateOfBirth);
    
    // Check PEP lists
    const pepCheck = await this.checkPEP(request.firstName, request.lastName);
    
    // Calculate risk score
    const riskScore = this.calculateRiskScore({
      documentValid,
      faceMatch,
      addressVerified,
      sanctionsCheck,
      pepCheck,
      country: request.address.country
    });

    // Determine status
    let status: KYCResult['status'] = 'approved';
    if (riskScore > 80) {
      status = 'rejected';
    } else if (riskScore > 60 || !sanctionsCheck || !pepCheck) {
      status = 'requires_review';
    } else if (!documentValid || !faceMatch) {
      status = 'rejected';
    }

    const result: KYCResult = {
      status,
      confidence: Math.max(0, 100 - riskScore),
      checks: {
        documentValid,
        faceMatch,
        addressVerified,
        sanctionsCheck,
        pepCheck
      },
      riskScore,
      verificationId
    };

    this.verifications.set(verificationId, result);
    
    console.log(`✅ KYC processed: ${status} (Risk: ${riskScore}%)`);
    return verificationId;
  }

  private async verifyDocument(type: string, number: string, image: string): Promise<boolean> {
    // Mock document verification
    console.log(`📄 Verifying ${type}: ${number}`);
    return Math.random() > 0.1; // 90% success rate
  }

  private async compareFaces(docImage: string, selfie: string): Promise<boolean> {
    // Mock face comparison
    console.log(`👤 Comparing faces`);
    return Math.random() > 0.05; // 95% success rate
  }

  private async verifyAddress(address: any): Promise<boolean> {
    // Mock address verification
    console.log(`🏠 Verifying address: ${address.city}, ${address.country}`);
    return Math.random() > 0.15; // 85% success rate
  }

  private async checkSanctions(firstName: string, lastName: string, dob: string): Promise<boolean> {
    // Mock sanctions screening
    console.log(`🚫 Checking sanctions: ${firstName} ${lastName}`);
    
    // Simulate some matches for demo
    const flaggedNames = ['john doe', 'jane smith'];
    const fullName = `${firstName} ${lastName}`.toLowerCase();
    
    return !flaggedNames.includes(fullName);
  }

  private async checkPEP(firstName: string, lastName: string): Promise<boolean> {
    // Mock PEP screening
    console.log(`🎭 Checking PEP status: ${firstName} ${lastName}`);
    return Math.random() > 0.02; // 2% PEP rate
  }

  private calculateRiskScore(factors: any): number {
    let score = 0;
    
    if (!factors.documentValid) score += 40;
    if (!factors.faceMatch) score += 30;
    if (!factors.addressVerified) score += 10;
    if (!factors.sanctionsCheck) score += 50;
    if (!factors.pepCheck) score += 20;
    
    // Country risk adjustment
    const highRiskCountries = ['AF', 'KP', 'IR', 'SY'];
    if (highRiskCountries.includes(factors.country)) {
      score += 25;
    }
    
    return Math.min(100, score);
  }

  async getVerificationStatus(verificationId: string): Promise<KYCResult | null> {
    return this.verifications.get(verificationId) || null;
  }

  async getUserVerifications(userId: string): Promise<KYCResult[]> {
    return Array.from(this.verifications.values())
      .filter(v => v.verificationId.includes(userId.substring(0, 8)));
  }
}
