import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  TrendingUp,
  Shield,
  Users,
  BarChart3,
  ArrowRight,
  CheckCircle,
  Star,
  Globe
} from "lucide-react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider
} from "firebase/auth";
import { auth } from "@/lib/firebase";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export function LandingPage() {
  const navigate = useNavigate();
  const [isSignIn, setIsSignIn] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignIn) {
        // SIGN IN - Use backend API since Firebase is not configured
        const response = await fetch(`${API_BASE_URL}/api/auth/signin`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          
          // Handle FastAPI validation errors (422 status)
          if (response.status === 422 && Array.isArray(errorData.detail)) {
            const errorMessages = errorData.detail.map((err: any) => {
              const field = err.loc ? err.loc[err.loc.length - 1] : 'field';
              return `${field}: ${err.msg}`;
            }).join(', ');
            throw new Error(errorMessages || 'Validation failed');
          }
          
          // Handle other errors
          const errorMessage = typeof errorData.detail === 'string' 
            ? errorData.detail 
            : Array.isArray(errorData.detail) 
              ? errorData.detail.map((e: any) => e.msg || e).join(', ')
              : 'Signin failed';
          throw new Error(errorMessage);
        }

        const data = await response.json();

        // Store the token from backend (use 'auth_token' to match other parts of the app)
        localStorage.setItem('auth_token', data.token);

        // Navigate to dashboard
        navigate('/dashboard');
      } else {
        // Validate passwords match
        if (formData.password !== formData.confirmPassword) {
          setError("Passwords do not match");
          setLoading(false);
          return;
        }

        // Backend handles Firebase Auth and Firestore
        const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            first_name: formData.firstName,
            last_name: formData.lastName,
            username: formData.username
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          
          // Handle FastAPI validation errors (422 status)
          if (response.status === 422 && Array.isArray(errorData.detail)) {
            const errorMessages = errorData.detail.map((err: any) => {
              const field = err.loc ? err.loc[err.loc.length - 1] : 'field';
              return `${field}: ${err.msg}`;
            }).join(', ');
            throw new Error(errorMessages || 'Validation failed');
          }
          
          // Handle other errors
          const errorMessage = typeof errorData.detail === 'string' 
            ? errorData.detail 
            : Array.isArray(errorData.detail) 
              ? errorData.detail.map((e: any) => e.msg || e).join(', ')
              : 'Signup failed';
          throw new Error(errorMessage);
        }

        const data = await response.json();

        // Store the token from backend (use 'auth_token' to match other parts of the app)
        localStorage.setItem('auth_token', data.token);

        // Navigate to dashboard
        navigate('/dashboard');
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!auth) {
      setError("Firebase is not configured. Please set up Firebase credentials.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Get the Firebase ID token
      const idToken = await user.getIdToken();
      
      // Send to backend to create/get user profile and get JWT token
      const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id_token: idToken,
          email: user.email,
          name: user.displayName || '',
          photo_url: user.photoURL || ''
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Google sign-in failed');
      }

      const data = await response.json();
      
      // Store the token
      localStorage.setItem('auth_token', data.token);
      
      // Navigate to dashboard
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      setError(err.message || 'Google sign-in failed');
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Video Background */}
      <div className="absolute inset-0">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover transform scale-105"
          style={{
            filter: 'blur(0.5px) brightness(0.4)',
            animation: 'slowPan 20s ease-in-out infinite alternate'
          }}
        >
          <source src="/pics/573265_Business_Stock_3840x2160.mp4" type="video/mp4" />
        </video>

        {/* Animated particles/dots */}
        <div className="absolute inset-0">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-white rounded-full opacity-20 animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 3}s`
              }}
            />
          ))}
        </div>

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-l from-purple-900/30 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex">
        {/* Mobile Header */}
        <div className="lg:hidden absolute top-8 left-8 z-20">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl overflow-hidden shadow-lg">
              <img
                src="/pics/3d-rendering-financial-neon-bull.jpg"
                alt="CrowdAlpha Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-white font-bold text-2xl drop-shadow-lg">CrowdAlpha</span>
          </div>
        </div>

        {/* Left Side - Hero Content */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-12 xl:px-20">
          <div className="max-w-lg">
            <div className="flex items-center space-x-3 mb-8">
              <div className="h-12 w-12 rounded-xl overflow-hidden shadow-lg">
                <img
                  src="/pics/3d-rendering-financial-neon-bull.jpg"
                  alt="CrowdAlpha Logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-white font-bold text-3xl drop-shadow-lg">CrowdAlpha</span>
            </div>

            <h1 className="text-5xl font-bold text-white mb-6 leading-tight">
              Smart Investment
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                Made Simple
              </span>
            </h1>

            <p className="text-xl text-blue-100 mb-8 leading-relaxed">
              Join groups of investors using AI-powered signals and crowd intelligence
              to make better investment decisions and grow your portfolio.
            </p>

            {/* Features */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <div className="flex items-center space-x-3 text-white">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-blue-100">AI-Powered Signals</span>
              </div>
              <div className="flex items-center space-x-3 text-white">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-blue-100">Real-time Analytics</span>
              </div>
              <div className="flex items-center space-x-3 text-white">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-blue-100">Crowd Intelligence</span>
              </div>
              <div className="flex items-center space-x-3 text-white">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-blue-100">Risk Management</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Auth Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center px-8 py-12">
          <div className="w-full max-w-md">
            <Card className="bg-white/95 backdrop-blur-sm border-0 shadow-2xl">
              <CardHeader className="text-center pb-6">
                <div className="flex items-center justify-center space-x-3 mb-4">
                  <div className="h-10 w-10 rounded-lg overflow-hidden">
                    <img
                      src="/pics/3d-rendering-financial-neon-bull.jpg"
                      alt="CrowdAlpha Logo"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-white font-bold text-xl drop-shadow-sm">CrowdAlpha</span>
                </div>

                <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
                  <button
                    onClick={() => setIsSignIn(true)}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${isSignIn
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => setIsSignIn(false)}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${!isSignIn
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    Sign Up
                  </button>
                </div>

                <CardTitle className="text-2xl font-bold text-white">
                  {isSignIn ? 'Welcome back' : 'Create your account'}
                </CardTitle>
                <p className="text-white/80 mt-2">
                  {isSignIn
                    ? 'Sign in to continue your investment journey'
                    : 'Join groups of smart investors today'
                  }
                </p>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {!isSignIn && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-white mb-2">
                          First Name
                        </label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            name="firstName"
                            type="text"
                            placeholder="Enter your first name"
                            value={formData.firstName}
                            onChange={handleInputChange}
                            className="pl-10 bg-gray-800 text-white placeholder-gray-400 border-gray-600 focus:border-blue-500"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-white mb-2">
                          Last Name
                        </label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            name="lastName"
                            type="text"
                            placeholder="Enter your last name"
                            value={formData.lastName}
                            onChange={handleInputChange}
                            className="pl-10 bg-gray-800 text-white placeholder-gray-400 border-gray-600 focus:border-blue-500"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-white mb-2">
                          Username
                        </label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            name="username"
                            type="text"
                            placeholder="Choose a username"
                            value={formData.username}
                            onChange={handleInputChange}
                            className="pl-10 bg-gray-800 text-white placeholder-gray-400 border-gray-600 focus:border-blue-500"
                            required
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        name="email"
                        type="email"
                        placeholder="Enter your email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="pl-10 bg-gray-800 text-white placeholder-gray-400 border-gray-600 focus:border-blue-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={formData.password}
                        onChange={handleInputChange}
                        className="pl-10 pr-10 bg-gray-800 text-white placeholder-gray-400 border-gray-600 focus:border-blue-500"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {!isSignIn && (
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          name="confirmPassword"
                          type="password"
                          placeholder="Confirm your password"
                          value={formData.confirmPassword}
                          onChange={handleInputChange}
                          className="pl-10 bg-gray-800 text-white placeholder-gray-400 border-gray-600 focus:border-blue-500"
                          required
                        />
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                      {error}
                    </div>
                  )}

                  {isSignIn && (
                    <div className="flex items-center justify-between">
                      <label className="flex items-center">
                        <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <span className="ml-2 text-sm text-white">Remember me</span>
                      </label>
                      <button type="button" className="text-sm text-blue-400 hover:text-blue-300">
                        Forgot password?
                      </button>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-3 text-lg font-semibold shadow-lg disabled:opacity-50"
                  >
                    {loading ? 'Loading...' : (isSignIn ? 'Sign In' : 'Create Account')}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>

                  {isSignIn && (
                    <div className="text-center">
                      <p className="text-sm text-white/80">
                        Don't have an account?{' '}
                        <button
                          type="button"
                          onClick={() => setIsSignIn(false)}
                          className="text-blue-400 hover:text-blue-300 font-medium"
                        >
                          Sign up here
                        </button>
                      </p>
                    </div>
                  )}
                </form>

                {/* Social Login */}
                <div className="mt-8">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-gray-800 text-white">Or continue with</span>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={handleGoogleSignIn}
                      disabled={loading || !auth}
                    >
                      <Globe className="h-4 w-4 mr-2" />
                      Google
                    </Button>
                    <Button variant="outline" className="w-full">
                      <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                      </svg>
                      Facebook
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Trust Indicators */}
            <div className="mt-8 text-center">
              <p className="text-white/80 text-sm mb-4">Trusted by leading investors</p>
              <div className="flex items-center justify-center space-x-6 text-white/60">
                <div className="flex items-center space-x-1">
                  <Star className="h-4 w-4 fill-current" />
                  <span className="text-sm">4.9/5</span>
                </div>
                <div className="text-sm">•</div>
                <div className="text-sm">SOC 2 Compliant</div>
                <div className="text-sm">•</div>
                <div className="text-sm">256-bit SSL</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}