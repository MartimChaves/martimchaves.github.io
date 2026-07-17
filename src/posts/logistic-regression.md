---
title: "Reinventing Code Agent: Part 1 - Reinventing Logistic Regression"
date: "2026-07-16"
description: "The simplest learnable function — and why all the pieces you need are already here"
draft: true
tags: ["Reinventing Code Agents", "ML"]
slug: "logistic-regression"
type: "tech"
---

Let's reinvent coding agents, like claude code, codex, and mistral vibe. We're considering a coding agent a bit of code that uses an LLM to write code, run it, and improve it.

The beginning of something is subjective, here we're going with the logistic function.

In mid 19th century, in Belgium, there was Pierre Verhulst. In that time, people were worried about famine and chaos. A few years before, Malthus said that population would grow exponentially, while food supply would grow linearly. You get a lot of people, but not a lot of food. Then you get, unfortunately, famine, deaths, chaos. These crisis would slow down population growth, even heavily reduce it, maybe even leading to some sort of equilibrium.

````tangent
What does it mean for population to grow exponentially?

An exponential growth of population can happen for many reasons, but fundamentally, it means that the births per person over their lifetime is larger than 1 - for this to happen, each couple needs to have more than 2 children (assuming that people eventually die).

If you look at today, so far, population has indeed grown a lot, it has more than doubled over the last century - but, generally speaking, the agri tech has kept up with the demand.

Play around with the parameters (life expectancy, number of children per couple, age at which they have them) below and check out how they affect population growth. A few assumptions are being made here, such as that every couple has children, every couple has the same age, and that the population at the start is mostly young people.


```population-growth
```
````

```interactive-plot xMin=-1 xMax=5 yMin=-1 yMax=5
exp(x)-1
x
```
Fig. 1 - Exponential growth versus linear growth

Pierre set off to try and model that. Population would start to grow exponentially, but, at some point, the amount of people itself would slow its growth down, as it approached a limit. What he arrived at was the logistic function - `1 / (1 + exp(-r * x))` - `r` being the growth rate. 

```interactive-plot xMin=-6 xMax=6 yMin=-0.2 yMax=1.2
1/(1 + exp(-1*x))
```
Fig. 3 - A logistic function

You can play around with the value of the growth rate to increase or decrease the slope around the y-axis, hence the name. The higher the `r`, the higher the growth rate, the faster the population grows. As it is, it converges towards `1` - if you want it to converge to a hypothetical population limit, you can just multiply the whole function by that limit (`L`) - `L / (1 + exp(-r * x))`.

This seemingly simple function is actually quite powerful, because it allows us to convert any number to a value between 0 and 1 - and this, it turns out, came in really handy in the realm of probabilities.

### The logistic function and probabilities

The logistic function was never meant to be used for probabilities, but by the end of the 19th century and early 20th century, S-shaped curves, like the logistic function, were all over the place. In chemistry, certain reactions could be represented by an S-curve (autocatalytic reactions). The Hill equation showed that blood oxygen saturation also follows an S-curve. Researchers studying the adoption of technology in agriculture and other domains, also found S-curves. The logistic function was a great fit for all of these phenomena. It was found in situations where growth of something depended on that something but it eventually had to reach a limit. So, I guess you could say, the logistic function was in the air.

At the same time, a revolution in medicine was happening. For a long time, there was little standardization in the amounts of remedies to administer, and doctors were mostly relying on experience. But medicine, along with everything else, was going industrial. Drugs were no longer created and administered *ad hoc* by doctors, they came in bottles and boxes, and they had to have a potency label. So, researchers studying the effects of these drugs wanted to standardize dosages. How much should be enough, and how much is definitely too much? 

Researchers were giving different doses of a drug to lab subjects and seeing whether or not each one responded. Individually, the outcome was binary: the treatment either worked or it didn't. Across a population, however, something interesting emerged. At very low doses, almost none of the subjects responded. At very high doses, almost all of them did. In between, the **fraction** of subjects that responded steadily increased with the dose. Sound familiar? Researchers were once again looking at an S-shaped curve. An S-curve that would tell them the relation between a dose and the fraction, the probability, of individuals responding.

So we're in the 1920s/1930s, and we need an S-curve to describe the impact of a dose of a certain drug. Researchers wanted to compare different drugs, see how they affected people differently, to better determine the right dose, and which one was best. Which one had less side effects, and so on. They wanted to model the data, with a function... A function that could convert a dose into a probability of response.

Now, a caveat: there actually were many different functions that researchers were experimenting with. Spoiler alert, over time, the logistic function won. Finally, the logistic function became the function used to convert doses to probabilities.

But why did the logistic function win? For a good reason! It was, mathematically, very easy to work with, especially because of its inverse. I'm not sure if Pierre realized this when he was playing around with the logistic function to model population, but its inverse turns out to be quite simple. If we consider $p$ to be the probability, and $d$ the dose, applying the logistic function we get:

$$
p = \frac{1}{1 + e^{-d}}
$$

Now, what if we want to go *backwards*? I.e. what if we want to know the dose that will get us a certain probability of success (i.e. the inverse)? Then we get:

$$
d = \ln\!\left(\frac{p}{1-p}\right)
$$

`````tangent
How do we get from $p = \frac{1}{1 + e^{-d}}$ to $d = \ln\!\left(\frac{p}{1-p}\right)$?

First, multiply both sides by $(1 + e^{-d})$:

$$
p \cdot (1 + e^{-d}) = 1
$$

Divide both sides by $p$:

$$
1 + e^{-d} = \frac{1}{p}
$$

Subtract $1$ from both sides:

$$
e^{-d} = \frac{1}{p} - 1 = \frac{1}{p} - \frac{p}{p} = \frac{1 - p}{p}
$$

Take the natural log of both sides:

$$
-d = \ln\!\left(\frac{1-p}{p}\right)
$$

And finally, multiply by $-1$ (which flips the fraction inside the log):

$$
d = \ln\!\left(\frac{p}{1-p}\right)
$$

````tangent
Why does multiplying by $-1$ flip the fraction inside the $\ln$?

First: why is $a^{-1} = \frac{1}{a}$. There's a pattern when you decrease the exponent by one. Using $a = 2$:

$$
2^3 = 8 \quad \rightarrow \quad 2^2 = 4 = \frac{8}{2} \quad \rightarrow \quad 2^1 = 2 = \frac{4}{2} \quad \rightarrow \quad 2^0 = 1 = \frac{2}{2}
$$

Every step down divides by $2$. We continue with the pattern after $0$:

$$
2^{-1} = \frac{1}{2} \quad \rightarrow \quad 2^{-2} = \frac{1}{4} \quad \rightarrow \quad 2^{-3} = \frac{1}{8}
$$

So $a^{-1}$ is just what you get when you keep dividing; it's $\frac{1}{a}$.

Second: why $\ln(a^b) = b \cdot \ln(a)$. This follows from the fact that logarithms turn multiplication into addition. But why do they do that? It comes from how exponents work. When you multiply two powers of the same base, you add the exponents:

$$
e^3 \cdot e^2 = (e \cdot e \cdot e) \cdot (e \cdot e) = e^{5} = e^{3+2}
$$

Now, $\ln$ is just the question "e to what power gives me this?" If $\ln(x) = m$ and $\ln(y) = n$, that means $e^m = x$ and $e^n = y$. So:

$$
x \cdot y = e^m \cdot e^n = e^{m+n}
$$

And asking "e to what power gives me $x \cdot y$?" gives us $m + n$, which is $\ln(x) + \ln(y)$.

If we apply the logarithm to $x \cdot y$ we get $\ln(x \cdot y) = \ln(e^{m+n}) = m + n = \ln(x) + \ln(y)$. So, multiplication on the inside became addition on the outside.

With that in hand: $\ln(a \cdot a) = \ln(a) + \ln(a)$. But $a \cdot a$ is just $a^2$, so:

$$
\ln(a^2) = \ln(a) + \ln(a) = 2 \cdot \ln(a)
$$

And $a \cdot a \cdot a = a^3$, so $\ln(a^3) = \ln(a) + \ln(a) + \ln(a) = 3 \cdot \ln(a)$. In general, $\ln(a^b) = b \cdot \ln(a)$.

Now plug in $b = -1$. We get $\ln(a^{-1}) = -1 \cdot \ln(a) = -\ln(a)$. And since we just showed $a^{-1} = \frac{1}{a}$:

$$
\ln\!\left(\frac{1}{a}\right) = -\ln(a)
$$

Negating a log flips the thing inside. Which gives us our last step:

$$
-\ln\!\left(\frac{1-p}{p}\right) = \ln\!\left(\frac{p}{1-p}\right)
$$
````
`````

You might be familiar with this function! It's none other than the log of the odds, or the logit function!


````tangent
What are odds? And why use the log of the odds?

The general idea of odds has been around for a long time. The word itself hints at its meaning - something unequal. If you happened to be in ancient Rome, watching a chariot race, you might've turned to the person beside you and said: "I'll give you two coins if Aurelius wins, you'll give me one coin if Romulus wins!". You confidently expect Aurelius to win. And in that unequalness, there's an implicit ratio - you think the likelihood of Aurelius winning is twice as large as the one of Romulus winning. In other words, if they were to race three times, Aurelius should win twice, while Romulus should only win once!

In simple terms, when stating the odds of something, we're saying how often we'll win ($W$) versus how often we'll lose ($L$) - and we represent it like this: $W$:$L$. Often, one of those numbers is set to 1 (as in simplifying a fraction), so we'll set it to $\frac{W}{L}$:$1$. This is a bit different from a probability. If we want to know the probability of winning, we can calculate it with the formula $\frac{W}{W+L}$, or $\frac{W/L}{W/L+1}$. So, let's say $X = \frac{W}{L}$. This means that $P = \frac{X}{X+1}$ - if we solve for $X$, we get $X = \frac{P}{1-P}$ - i.e. the odds function we've seen before.

There is one annoying thing about odds though - they're not symmetrical. If winning is twice as likely, then the odds are $2$:$1$. If it's half as likely, the odds are $0.5$:$1$. If winning is just as likely as losing, then the odds are $1$:$1$. Twice as likely or half as likely feel like they should be equidistant from $1$, but they're not. Plus, odds can go from $0$ to $\infty$, and an unlikely win is "crammed" into the space between $0$ and $1$, while a likely win can go from $1$ to $\infty$.

A way to "solve" this is by taking the log of the odds! The log of the space between $0$ and $1$ is as "large" as the log between the space of $1$ and $\infty$. And, it's also symmetrical around the value $1$ - $\ln(0.5) \approx -0.69$, and $\ln(2) \approx 0.69$. So, now we get symmetry.

````

At the time, and even today, researchers had an intuition for what the log of odds meant, or for comparing two different log of the odds. In the same way that you and I have an intuitive idea of what 1.5 meters means (or 5 feet if you're used to imperial unites), researchers had an intuitive idea of what the log of odds meant, or what does it mean for a drug A to have a log of odds 1.7 response when the dose was 2 miligrams, versus the drug B having a log of odds response of 2.5 for the same dosage, for example. A log-odds of 0 means a 1:1 odds, even odds. Each unit of log-odds roughly triples the odds (since e is around 2.7). For the drug A (1.7) vs drug B (2.5) example, drug B has around twice the odds of being effective, when compared to drug A, since the difference of the log-odds is 0.8. So for every two subjects that don't respond to drug A, one of them would have responded to drug B.

Researchers being familiar with it was great, but there was something else that really mattered as well - now, instead of using the raw probability data, researchers could apply the log of odds transformation to the raw probability data, and this meant that they could model the relationship between probability and dosage in a linear way!

Now, we actually have to make a slight correction. $d = \text{p}$ is one function, the same as $x = y$, so we need to add parameters so that we can describe each and every one of the different drugs, or different phenomena that we're studying. So, really, we're dealing with $\beta d + \alpha$.

So, summarizing, we're looking at:
$$
\alpha + \beta d = \ln\!\left(\frac{p}{1-p}\right)
$$

You might be confused with the $\ln\!\left(\frac{p}{1-p}\right)$ - but remember, this really is just there to remind us that we're applying the log odds transformation to the raw probability data.

If we were to consider the following:
$$
p^* = \ln\!\left(\frac{p}{1-p}\right)
$$

Then, we can write:

$$
p^* = \alpha + \beta d
$$

Cool, right? Instead of having to deal with this:

```interactive-plot xMin=-1 xMax=8 yMin=-0.1 yMax=1.1
1/(1 + exp(-(-3 + x)))
```
Fig. 4 - Dose vs. probability of response: an S-curve.

We can actually work with this:

```interactive-plot xMin=-1 xMax=8 yMin=-5 yMax=5
-3 + x
```
Fig. 5 - Dose vs. log-odds of response: a straight line.

It's the same data! And we're still capturing the relationship between the dose and probability. At the core, we're using the logistic function, but we can manipulate it so that it's easier to understand. $\alpha$ tells us where the line crosses zero, and this is the dose at which we have a 50/50 chance of response. $\beta$ is the slope, and it tells us how sharply the response changes with the dose. Remember, we're in the 1920s, there are no computers or graphing calculators! Getting these two numbers from a straight line is something that we can do with a ruler and a pencil!

### From the logistic function to logistic regression

When the 1940s came around, researchers wanted to know the probability of getting a response to a certain dosage with more accuracy, and for that they looked at other relevant variables, such as the patient's age and weight. This meant that the equation would have more terms.

There was one key difference though - now we have a lot more variables, so making groups gets tricky. Before, we could aggregate around dosages (2mg, 2.5mg, 3mg, ...), but since each subject is a unique combination of dose, age, and weight, we're better off just using the individual data points, instead of aggregating. And since we're using the individual data points, instead of calculating probabilities, we can look at the subject's response as something binary - did they respond or not? Instead of using $p$, we'll be using $y$.

So, now, we get something like this:

$$
y = \frac{1}{1 + e^{-(a + b_1 \cdot \text{dose} + b_2 \cdot \text{age} + b_3 \cdot \text{weight})}}
$$

Reminder - we **have** the fundamental data. This is, we know what $y$ should be for a given dose, age, and weight - what we need to know is $a$, $b_1$, $b_2$, and $b_3$. If you think about it, these 4 parameters are essentially the descriptors of a drug.

This isn't really something that we can do with a ruler and pencil anymore. But, lucky for us, there are other ways to get those parameteres. Figuring them out is what we call "fitting the parameters to the data" - a.k.a. **regression**. Since we're doing regression using the logistic function, this IS logistic regression! We have arrived!

But then, how do we exactly fit those parameters?

There are many different ways of doing that, some of them involving more or less complex calculations - and in the early 1960s, computers were just becoming available, which made this process much easier, and thus more popular. Historically, the most common method was the **Newton-Raphson method**, but it's a bit tricky, so it has fallen out of style. Nowadays, and this is the method that we'll be exploring, we use something called **gradient descent**. And to use gradient descent, we first have to talk about **loss functions**.

#### Loss functions? I'm at a loss here...

So, for a certain subject, with a specific dose, age, and weight, we **know** what $y$ should be, we got that from real world data.

Now, what we're trying to do is **find** the parameters $a$, $b_1$, $b_2$, and $b_3$. This way, we can build out a function that matches the real world data, that **describes** the data. From there, we can use the values of these parameters as descriptors of the drug, and compare it to other drugs. To get fancy, we can "model" the drug.

To get started, we actually assign random values to the parameters. Then, we can calculate a "temporary $y$" for each data point - we'll use $\hat{y}$ to represent that value. This $\hat{y}$ is going to be different from the real value, because we're using random parameters. So, now we have two different "$y$s": the real expected value, the one we got from real data - $y$ - and the value that we get from our function with randomly initialized parameters - $\hat{y}$. To distinguish between these two, we'll be using the term "label" for the real value $y$, and we'll be using the term "prediction" for the value that we get from our function $\hat{y}$. We use "label" as in the true label, the real value. We use prediction because, later on, we'll use the function with the appropriate parameters (parameters that fit the data), to predict values for data points with doses, ages, and weights that we haven't measured yet.

Loss is a word we use to mean **difference** - the difference between the label and the prediction. The smaller the difference, the better! The smaller the difference, the more accurate our function is, which is what we want. The simplest loss function is just: $L = y - \hat{y}$. That's it. But the thing with that loss function, is that it can be negative. This is a problem if we're averaging out the losses for different subjects, because then positive and negative losses can cancel each other out, giving us an overall false sense of accuracy.

So, we can ask ourselves, what would be a good loss function that would work with logistic regression? A good way to think about this is by asking how big the loss should be?

Say that a subject responded, so $y=1$. If our prediction is $\hat{y}=0.9$, then the loss should be small. If our prediction is $\hat{y}=0.1$, then the loss should be big. If our prediction is $\hat{y}=0.01$, then the loss should be really big, and ideally much larger than the loss when $\hat{y}=0.1$ - because this way, we're punishing very confident errors. We can try the log of the prediction. $ln(1) = 0$, which is perfect, since if $y=1$ and $\hat{y}=1$, then the loss should be 0. Then, $ln(0.9) = -0.105$, $ln(0.1) = -2.303$, $ln(0.01) = -4.605$. Notice how the more wrong the prediction is, the bigger the absolute value of the loss is. The only issue is that it's negative, but we can deal with this by just multiplying it by $-1$. So, when $y=1$ we can calculate the loss by using $-ln(\hat{y})$.

What if a subject did not respond, so $y=0$? Then, similar to before but in a symmetric way, the loss should be small when $\hat{y}=0.1$, big when $\hat{y}=0.9$, and really big when $\hat{y}=0.99$. We can try using the log again, but we have to be careful - we need to use the log of $1-\hat{y}$ instead of $\hat{y}$. For example, if we predict 0.9, $-ln(1-0.9) = -ln(0.1) = 2.303$. Then, $-ln(1-0.99) = -ln(0.01) = 4.605$. So, again, the more wrong the prediction, the bigger the loss. Then, $-ln(1-0.1) = -ln(0.9) = 0.105$, $-ln(1-0.01) = -ln(0.99) = 0.010$, so the more correct the prediction, the faster the loss gets to zero.

Great, so now we just have to combine these two different functions, so that when $y=1$ we use $-ln(\hat{y})$ and when $y=0$ we use $-ln(1-\hat{y})$. We can do this by using the following formula:

$$
L = y \cdot -\ln(\hat{y}) + (1-y) \cdot -\ln(1-\hat{y})
$$

Note that the label determines what gets used: if $y=1$, then $(1-y)=0$, so only the first term is used; if $y=0$, then $(1-y)=1$, so only the second term is used.

By the way, this is called the cross-entropy loss. This comes from information theory, and honestly it would be going down a rabbit-hole explaining why it's called that. But now that we reinvented loss functions, more specifically the cross-entropy loss function, we can move on to the next key step, which is **gradient descent**.

#### Down with the gradient!

So, first of all, what is the gradient? The gradient tells you how to change the parameters so that the calculated outcome is furthest away from the real outcome.

"The gradient is the direction of steepest ascent of a function."

Yikes.
 

- 1930s: logistic function used for dose-response, single input, fitting done graphically (ruler and pencil)
- 1940s: researchers realize a drug's effect depends on more than just dose — age, weight, prior conditions, etc.
- The equation just gets more terms: p* = a + b1 * dose + b2 * age + b3 * weight + ... - still linear, just more dimensions
- But now you can't fit it with a ruler anymore - too many parameters to eyeball
- 1958: David Cox formalizes logistic regression for multiple predictors. Early computers are just becoming available, making it practical
- Since we're fitting parameters to data (regression) using the logistic function, this IS logistic regression
- The name isn't a new invention - it's just what researchers were already doing, now formalized and generalized
- How do we find the best parameters? Historically: Newton-Raphson (uses second derivatives, converges fast, practical for small datasets on early computers)
- Modern ML approach (and what we'll use): cross-entropy loss + gradient descent - simpler, only needs first derivatives, scales to massive datasets
- Once you see the setup as "linear combination -> logistic function -> probability," there's nothing dose-specific about it - inputs could be word counts (spam), pixel values (images), symptoms (diagnosis). The logistic function doesn't care what the inputs mean
- This is where dose-response analysis becomes classic machine learning

to-do:
- change previous parameters from alfa/beta to bias/weight
- all functions to latex for consistency
- source for historical bits

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
  ...    ├──► z = w·x + b ──► σ(z) = ŷ ──► L(ŷ, y)
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
