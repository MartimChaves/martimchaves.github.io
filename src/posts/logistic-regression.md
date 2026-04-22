---
title: "Part 1: Logistic Regression"
date: "2026-04-22"
description: "The simplest learnable function — and why all the pieces you need are already here"
draft: false
tags: ["Reinventing Code Agents", "ML"]
slug: "logistic-regression"
type: "tech"
---

This series builds a code agent from scratch. A system that reads your codebase, plans a task, writes code, runs it, and fixes what breaks. That's complex. But every piece of it traces back to simple ideas, stacked.

Each post is a node in a tech tree — you need this to build the next thing. This is node 1.

Before we get to code agents, before language models, before neural networks even — we need the most primitive learnable function there is: logistic regression.

### What it means to learn

Say you want to classify emails as spam or not spam. You have features — word counts, sender reputation, subject length. You want a function that maps those features to a probability: 0.9 means "very likely spam", 0.1 means "probably not".

You could write rules by hand. But rules are fragile. What you really want is a function that *learns* what matters from examples — one whose behavior you can tune by showing it data and adjusting its internal parameters to reduce mistakes.

That's the core idea, and it runs all the way through this series.

### The function

Logistic regression is that idea in its simplest form. Two parts.

First, a linear combination of inputs:

```
z = w₁·x₁ + w₂·x₂ + ... + wₙ·xₙ + b
```

`w` are the weights (what the function "knows"), `x` are the input features, `b` is a bias term. This is just a dot product: `z = w·x + b`.

`z` can be any real number. But we want a probability — something between 0 and 1. So we squash it through the sigmoid function:

```
σ(z) = 1 / (1 + e^(-z))
```

The sigmoid maps any real number to (0, 1). Large positive `z` gives near 1. Large negative `z` gives near 0. `z = 0` gives exactly 0.5.

```
z:     -∞   -3    0    3   +∞
σ(z):   0  0.05  0.5  0.95   1
```

Visualized as a computation graph:

```
x₁ ──w₁──┐
x₂ ──w₂──┤
  ...     ├──► z = w·x + b ──► σ(z) = ŷ ──► L(ŷ, y)
xₙ ──wₙ──┘
      b ──┘
```

That's the full forward pass: `ŷ = σ(w·x + b)`. One input vector in, one probability out.

### The loss function

We have a prediction `ŷ`. We have the true label `y ∈ {0, 1}`. We need to measure how wrong we are.

Binary cross-entropy does this:

```
L = -[y·log(ŷ) + (1-y)·log(1-ŷ)]
```

When `y = 1`: loss is `-log(ŷ)`. Predicting `ŷ = 0.99` gives loss ≈ 0.01. Predicting `ŷ = 0.01` gives loss ≈ 4.6. Being confidently wrong is punished harshly. When `y = 0`: same thing, flipped.

This asymmetric punishment is intentional. It forces the model to be calibrated, not just directionally right.

### Gradient descent

We want weights `w` and bias `b` that minimize the loss across all training examples. We find them with gradient descent.

The gradient of the loss tells us the direction of steepest increase. We step the opposite way:

```
w = w - α · ∂L/∂w
b = b - α · ∂L/∂b
```

`α` is the learning rate — how big a step to take.

Computing the gradients with the chain rule yields a satisfying result:

```
∂L/∂w = (ŷ - y) · x
∂L/∂b = (ŷ - y)
```

The gradient is just the prediction error times the input. If we predicted too high (`ŷ > y`), we reduce `w` for features where `x > 0`. If we predicted too low, we increase them. The math tells us exactly which direction to push each weight — and by how much.

### The code

```python
import numpy as np

def sigmoid(z):
    return 1 / (1 + np.exp(-z))

def binary_cross_entropy(y_pred, y_true):
    eps = 1e-9  # avoid log(0)
    return -np.mean(
        y_true * np.log(y_pred + eps) + (1 - y_true) * np.log(1 - y_pred + eps)
    )

class LogisticRegression:
    def __init__(self, lr=0.1, n_steps=1000):
        self.lr = lr
        self.n_steps = n_steps
        self.w = None
        self.b = 0.0

    def fit(self, X, y):
        n_samples, n_features = X.shape
        self.w = np.zeros(n_features)

        for _ in range(self.n_steps):
            z = X @ self.w + self.b
            y_pred = sigmoid(z)

            error = y_pred - y
            self.w -= self.lr * (X.T @ error) / n_samples
            self.b -= self.lr * np.mean(error)

    def predict_proba(self, X):
        return sigmoid(X @ self.w + self.b)

    def predict(self, X, threshold=0.5):
        return (self.predict_proba(X) >= threshold).astype(int)
```

Let's test it on an OR gate — the simplest problem where inputs need to be combined:

```python
X = np.array([[0, 0], [0, 1], [1, 0], [1, 1]], dtype=float)
y = np.array([0, 1, 1, 1])  # OR: true if any input is 1

model = LogisticRegression(lr=0.5, n_steps=2000)
model.fit(X, y)

print(model.predict(X))          # [0, 1, 1, 1]
print(model.predict_proba(X).round(2))  # [0.07, 0.94, 0.94, 1.0]
```

The model learns the correct classification, with confident probabilities. Now try XOR (`y = [0, 1, 1, 0]`) — it fails. A single linear boundary can't separate XOR. That limitation is exactly what the next post solves.

### What this unlocks

Logistic regression is one neuron: one linear transformation followed by one nonlinearity. All five concepts that scale this up to LLMs are already here:

1. **Parameters** — weights `w` and bias `b` encode what the model knows
2. **Forward pass** — compute a prediction from inputs and parameters
3. **Loss** — a scalar that measures how wrong the prediction is
4. **Gradients** — the direction to adjust parameters to reduce loss
5. **Gradient descent** — the update rule that iterates toward a solution

In the next post, we stack many of these neurons together into layers. The decision boundary becomes arbitrarily complex. The gradient descent loop stays exactly the same.
