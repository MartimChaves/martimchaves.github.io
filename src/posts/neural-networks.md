---
title: "Part 2: Neural Networks"
date: "2026-04-23"
description: "Stack two layers, solve XOR, and discover why backpropagation is just the chain rule"
draft: false
tags: ["Reinventing Code Agents", "ML"]
slug: "neural-networks"
type: "tech"
---

In [Part 1](/blog/logistic-regression), we built logistic regression — a single learnable function — and ended with a problem it couldn't solve: XOR. The inputs `(0,1)` and `(1,0)` are both class 1, but `(0,0)` and `(1,1)` are class 0. No single straight line can separate them.

This post fixes that. We add a hidden layer, get nonlinear decision boundaries, and build the training algorithm that scales to every network in this series: backpropagation.

### Why one layer isn't enough

A logistic regression draws one linear boundary through the input space. Every point on one side is class 0, every point on the other is class 1. XOR needs two boundaries — it's shaped like a checkerboard.

The fix: stack two layers. The first layer transforms the inputs into a new representation (a learned coordinate system), and the second layer classifies in that new space. With the right first layer, XOR becomes linearly separable.

This is the core power of neural networks: the hidden layers learn to re-represent the data so that the final layer's job is easy.

### The forward pass

A two-layer network — one hidden layer, one output — works like this:

```
Layer 1 (hidden):   Z¹ = X · W¹ + b¹
                    A¹ = ReLU(Z¹)

Layer 2 (output):   Z² = A¹ · W² + b²
                    ŷ  = σ(Z²)
```

`X` is the input matrix (one row per example). `W¹`, `b¹`, `W²`, `b²` are learnable parameters. `A¹` is the hidden layer's activations — the new representation.

We use **ReLU** for the hidden layer: `ReLU(z) = max(0, z)`. It's simple, non-linear, and its gradient is either 0 or 1 — no squashing, no vanishing. We keep sigmoid at the output for the probability interpretation.

```
Input     Hidden (ReLU)    Output (sigmoid)
  x₁ ──┐
        ├──► h₁ ──┐
  x₂ ──┘    h₂    ├──► ŷ
             h₃ ──┘
             h₄
```

### Backpropagation

We have the same loss as before — binary cross-entropy. The question is how to compute `∂L/∂W¹` and `∂L/∂W²`.

The answer is the chain rule, applied backward through the computation graph. Starting from the loss, we propagate gradients layer by layer toward the inputs. Each layer receives a gradient, uses it to compute its own parameter gradients, and passes a modified gradient further back.

**Output layer** — identical to logistic regression:

```
δ² = ŷ - y              (gradient of loss w.r.t. Z²)
dW² = (A¹)ᵀ · δ²
db² = sum(δ², axis=0)
```

**Hidden layer** — chain the gradient back through W² and through ReLU:

```
δ¹ = (δ² · (W²)ᵀ) * ReLU'(Z¹)
dW¹ = Xᵀ · δ¹
db¹ = sum(δ¹, axis=0)
```

`ReLU'(Z¹)` is 1 where `Z¹ > 0` and 0 elsewhere — we just zero out the gradient for neurons that weren't active. This is the only new piece compared to logistic regression. Everything else is the same chain-rule logic.

The update rule is unchanged:

```
W = W - α · dW
b = b - α · db
```

### The code

```python
import numpy as np

def sigmoid(z):
    return 1 / (1 + np.exp(-z))

def relu(z):
    return np.maximum(0, z)

def relu_grad(z):
    return (z > 0).astype(float)

def binary_cross_entropy(y_pred, y_true):
    eps = 1e-9
    return -np.mean(
        y_true * np.log(y_pred + eps) + (1 - y_true) * np.log(1 - y_pred + eps)
    )

class MLP:
    def __init__(self, n_hidden=4, lr=0.1, n_steps=10000):
        self.n_hidden = n_hidden
        self.lr = lr
        self.n_steps = n_steps

    def fit(self, X, y):
        n_in = X.shape[1]
        # He initialization: keeps variance stable through ReLU layers
        self.W1 = np.random.randn(n_in, self.n_hidden) * np.sqrt(2 / n_in)
        self.b1 = np.zeros(self.n_hidden)
        self.W2 = np.random.randn(self.n_hidden, 1) * np.sqrt(2 / self.n_hidden)
        self.b2 = np.zeros(1)
        y = y.reshape(-1, 1)

        for _ in range(self.n_steps):
            # Forward pass
            Z1 = X @ self.W1 + self.b1
            A1 = relu(Z1)
            Z2 = A1 @ self.W2 + self.b2
            y_pred = sigmoid(Z2)

            # Backward pass
            n = X.shape[0]
            d2 = y_pred - y
            dW2 = (A1.T @ d2) / n
            db2 = d2.mean(axis=0)

            d1 = (d2 @ self.W2.T) * relu_grad(Z1)
            dW1 = (X.T @ d1) / n
            db1 = d1.mean(axis=0)

            self.W1 -= self.lr * dW1
            self.b1 -= self.lr * db1
            self.W2 -= self.lr * dW2
            self.b2 -= self.lr * db2

    def predict_proba(self, X):
        A1 = relu(X @ self.W1 + self.b1)
        return sigmoid(A1 @ self.W2 + self.b2).flatten()

    def predict(self, X, threshold=0.5):
        return (self.predict_proba(X) >= threshold).astype(int)
```

XOR, which stumped logistic regression:

```python
X = np.array([[0, 0], [0, 1], [1, 0], [1, 1]], dtype=float)
y = np.array([0, 1, 1, 0])  # XOR

model = MLP(n_hidden=4, lr=0.5, n_steps=10000)
model.fit(X, y)

print(model.predict(X))          # [0, 1, 1, 0]
print(model.predict_proba(X).round(2))  # [0.02, 0.98, 0.98, 0.02]
```

Solved. The hidden layer learned a representation of the inputs where XOR is linearly separable.

### What this unlocks

With two layers and gradient descent, you can approximate any continuous function — this is the universal approximation theorem. Add more hidden units or more layers to increase capacity.

But depth creates a problem: as gradients flow backward through many layers, they get multiplied by weights over and over. They shrink toward zero (or explode). Training deep networks with sigmoid activations is nearly impossible for this reason — the vanishing gradient problem.

Part 3 covers the architectural ideas that fix this: residual connections and the sequence-processing models that preceded transformers.
